import type { Server, Socket } from "socket.io";
import { db } from "@/db";
import { messages, channelMembers, conversationParticipants, channels, conversations, fileAttachments, members, guestChannelAccess, organization } from "@/db/schema";
import { eq, and, isNull, sql, inArray, lt, desc } from "drizzle-orm";
import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import type { RateLimiterAbstract } from "rate-limiter-flexible";
import { getRoomName } from "../rooms";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, Message, Attachment } from "@/lib/socket-events";
import { users } from "@/db/schema";
import { parseMentions } from "@/lib/mentions/core";
import { createNotifications } from "./notification";
import { getPresenceManager, getUnreadManager, getWorkspaceUnreadManager } from "../index";
import { sendPushToUser, type PushPayload } from "@/lib/push";
import { extractUrls } from "@/lib/url-extractor";
import { linkPreviewQueue } from "@/server/queue/link-preview.queue";
import { sanitizeUnicode } from "@/lib/sanitize";
import { createRedisClient } from "@/server/redis";

/**
 * Check if user is a guest and if so, verify access and soft-lock status
 */
async function checkGuestAccess(
  userId: string,
  targetId: string,
  targetType: "channel" | "dm"
): Promise<{ allowed: boolean; error?: string }> {
  // Get channel's organization to find membership
  let organizationId: string | null = null;
  if (targetType === "channel") {
    const [channel] = await db
      .select({ organizationId: channels.organizationId })
      .from(channels)
      .where(eq(channels.id, targetId))
      .limit(1);
    organizationId = channel?.organizationId ?? null;
  } else {
    const [conv] = await db
      .select({ organizationId: conversations.organizationId })
      .from(conversations)
      .where(eq(conversations.id, targetId))
      .limit(1);
    organizationId = conv?.organizationId ?? null;
  }

  if (!organizationId) {
    return { allowed: true }; // Let normal validation handle missing channel/conversation
  }

  // Check if user is a guest in this organization
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });

  if (!membership || !membership.isGuest) {
    return { allowed: true }; // Not a guest, skip guest-specific checks
  }

  // Guest is soft-locked - can view but not post
  if (membership.guestSoftLocked) {
    return {
      allowed: false,
      error: "Your guest access has expired. Please contact an admin to extend your access.",
    };
  }

  // For channels, verify guest has access to this specific channel
  if (targetType === "channel") {
    const guestAccess = await db.query.guestChannelAccess.findFirst({
      where: and(
        eq(guestChannelAccess.memberId, membership.id),
        eq(guestChannelAccess.channelId, targetId)
      ),
    });

    if (!guestAccess) {
      return {
        allowed: false,
        error: "You do not have access to this channel.",
      };
    }
  }

  // GUST-04: Guests can send messages in allowed channels
  return { allowed: true };
}

const MAX_MESSAGE_LENGTH = 10_000;

// SECFIX-06: Rate limiter - 10 messages per 60 seconds per user
// UPGRADE: Use Redis for multi-instance consistency in production deployments
// Falls back to in-memory rate limiting if Redis is unavailable
let messageRateLimiter: RateLimiterAbstract;

function initializeRateLimiter(): RateLimiterAbstract {
  try {
    const redisClient = createRedisClient();
    console.log("[Socket.IO] Using Redis-backed rate limiting for multi-instance consistency");
    return new RateLimiterRedis({
      storeClient: redisClient,
      points: 10,
      duration: 60,
      keyPrefix: "socket:msg:rl",
    });
  } catch (error) {
    console.warn("[Socket.IO] Redis unavailable, using in-memory rate limiting (single-instance only)", error);
    return new RateLimiterMemory({
      points: 10,
      duration: 60,
      keyPrefix: "message",
    });
  }
}

// Initialize lazily to ensure Redis connection settings are available
function getRateLimiter(): RateLimiterAbstract {
  if (!messageRateLimiter) {
    messageRateLimiter = initializeRateLimiter();
  }
  return messageRateLimiter;
}

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Handle message:send event.
 * Validates membership, generates sequence number, persists message, and broadcasts to room.
 * FILE-08/FILE-09: Links attachments to message and includes them in broadcast.
 */
async function handleSendMessage(
  socket: SocketWithData,
  io: SocketIOServer,
  data: { targetId: string; targetType: "channel" | "dm"; content: string; attachmentIds?: string[] },
  callback?: (response: { success: boolean; messageId?: string }) => void
): Promise<void> {
  const userId = socket.data.userId;
  const { targetId, targetType, content, attachmentIds } = data;

  try {
    // SECFIX-06: Rate limit check (uses Redis for multi-instance consistency)
    try {
      await getRateLimiter().consume(userId);
    } catch (rejRes: unknown) {
      const rateLimitResult = rejRes as { msBeforeNext: number };
      socket.emit("error", {
        message: "Message rate limit reached. Please wait.",
        code: "RATE_LIMITED",
        retryAfter: Math.ceil(rateLimitResult.msBeforeNext / 1000),
      });
      callback?.({ success: false });
      return;
    }

    // SECFIX-05: Server-side length validation
    if (content.length > MAX_MESSAGE_LENGTH) {
      socket.emit("error", {
        message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH.toLocaleString()} characters`,
        code: "MESSAGE_TOO_LONG",
      });
      callback?.({ success: false });
      return;
    }

    // GUST-02, GUST-04: Check guest access and soft-lock status
    const guestCheck = await checkGuestAccess(userId, targetId, targetType);
    if (!guestCheck.allowed) {
      socket.emit("error", {
        message: guestCheck.error || "Guest access denied",
        code: "GUEST_ACCESS_DENIED",
      });
      callback?.({ success: false });
      return;
    }

    // Validate membership
    if (targetType === "channel") {
      // ARCH-01: Check if channel is archived before accepting message
      const [channel] = await db
        .select({ isArchived: channels.isArchived })
        .from(channels)
        .where(eq(channels.id, targetId))
        .limit(1);

      if (channel?.isArchived) {
        socket.emit("error", {
          message: "Cannot send messages to archived channels",
          code: "CHANNEL_ARCHIVED",
        });
        callback?.({ success: false });
        return;
      }

      const membership = await db
        .select()
        .from(channelMembers)
        .where(and(eq(channelMembers.channelId, targetId), eq(channelMembers.userId, userId)))
        .limit(1);

      if (membership.length === 0) {
        socket.emit("error", { message: "Not a member of this channel" });
        callback?.({ success: false });
        return;
      }
    } else {
      const participation = await db
        .select()
        .from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, targetId), eq(conversationParticipants.userId, userId)))
        .limit(1);

      if (participation.length === 0) {
        socket.emit("error", { message: "Not a participant in this conversation" });
        callback?.({ success: false });
        return;
      }
    }

    // SEC2-05: Sanitize Unicode control characters before storage
    // Replaces dangerous chars (control, zero-width, RTL override) with visible placeholder
    // Preserves ZWJ for emoji sequences (family emoji, professional emoji)
    const sanitizedContent = sanitizeUnicode(content);

    // SECFIX-03: Atomic sequence generation with retry
    const insertMessageWithRetry = async (retries = 3): Promise<typeof messages.$inferSelect> => {
      const condition = targetType === "channel"
        ? sql`channel_id = ${targetId}`
        : sql`conversation_id = ${targetId}`;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const [newMsg] = await db
            .insert(messages)
            .values({
              content: sanitizedContent,
              authorId: userId,
              channelId: targetType === "channel" ? targetId : null,
              conversationId: targetType === "dm" ? targetId : null,
              sequence: sql`(SELECT COALESCE(MAX(sequence), 0) + 1 FROM messages WHERE ${condition})`,
            })
            .returning();
          return newMsg;
        } catch (error: unknown) {
          const dbError = error as { code?: string };
          // PostgreSQL unique constraint violation - retry
          if (dbError.code === "23505" && attempt < retries - 1) {
            continue;
          }
          throw error;
        }
      }
      throw new Error("Failed to insert message after retries");
    };

    const newMessage = await insertMessageWithRetry();

    // FILE-08/FILE-09: Link attachments to message if provided
    let messageAttachments: Attachment[] = [];
    if (attachmentIds && attachmentIds.length > 0) {
      // Validate attachments exist and belong to current user
      const validAttachments = await db
        .select()
        .from(fileAttachments)
        .where(
          and(
            inArray(fileAttachments.id, attachmentIds),
            eq(fileAttachments.uploadedBy, userId),
            isNull(fileAttachments.messageId) // Only unassigned attachments
          )
        );

      if (validAttachments.length > 0) {
        // Update attachments to link to this message
        await db
          .update(fileAttachments)
          .set({ messageId: newMessage.id })
          .where(inArray(fileAttachments.id, validAttachments.map((a) => a.id)));

        // Map to Attachment type for broadcast
        messageAttachments = validAttachments.map((a) => ({
          id: a.id,
          originalName: a.originalName,
          path: a.path,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          isImage: a.isImage,
        }));
      }
    }

    // Get author info for broadcast
    const [author] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));

    // GUST-03: Check if author is a guest in the relevant organization
    let authorIsGuest = false;
    const orgId = targetType === "channel"
      ? (await db.select({ organizationId: channels.organizationId }).from(channels).where(eq(channels.id, targetId)).limit(1))[0]?.organizationId
      : (await db.select({ organizationId: conversations.organizationId }).from(conversations).where(eq(conversations.id, targetId)).limit(1))[0]?.organizationId;

    if (orgId) {
      const membership = await db.query.members.findFirst({
        where: and(eq(members.userId, userId), eq(members.organizationId, orgId)),
        columns: { isGuest: true },
      });
      authorIsGuest = membership?.isGuest ?? false;
    }

    const messageWithAuthor: Message = {
      id: newMessage.id,
      content: newMessage.content,
      authorId: newMessage.authorId,
      channelId: newMessage.channelId,
      conversationId: newMessage.conversationId,
      sequence: newMessage.sequence,
      deletedAt: newMessage.deletedAt,
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
      author: author ? { id: author.id, name: author.name, email: author.email, isGuest: authorIsGuest } : undefined,
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
    };

    // Broadcast to room
    const roomName = targetType === "channel"
      ? getRoomName.channel(targetId)
      : getRoomName.conversation(targetId);

    io.to(roomName).emit("message:new", messageWithAuthor);

    // Acknowledge success
    callback?.({ success: true, messageId: newMessage.id });

    console.log(`[Message] User ${userId} sent message ${newMessage.id} to ${targetType}:${targetId}`);

    // Queue link preview jobs for URLs in message content (LINK-01)
    const urls = extractUrls(content);
    if (urls.length > 0) {
      // Queue each URL as a separate job with position (LINK-02: max 5 URLs enforced by extractUrls)
      urls.forEach((url, position) => {
        linkPreviewQueue.add(
          `preview-${newMessage.id}-${position}`,
          {
            messageId: newMessage.id,
            url,
            position,
          },
          {
            // Dedupe by URL+message to avoid double-fetching on reconnects
            // Note: BullMQ jobId cannot contain colons, so we encode the URL
            jobId: `${newMessage.id}-${Buffer.from(url).toString('base64url')}`,
          }
        ).catch((err) => {
          console.error("[Message] Error queueing link preview:", err);
        });
      });
      console.log(`[Message] Queued ${urls.length} link preview job(s) for message ${newMessage.id}`);
    }

    // Create notifications for mentions
    const mentions = parseMentions(content);
    if (mentions.length > 0) {
      // Get workspaceId from channel if in channel context
      let workspaceId: string | undefined;
      if (targetType === "channel") {
        const [channelData] = await db
          .select({ organizationId: channels.organizationId })
          .from(channels)
          .where(eq(channels.id, targetId))
          .limit(1);
        workspaceId = channelData?.organizationId;
      }

      createNotifications({
        io,
        message: messageWithAuthor,
        mentions,
        senderId: userId,
        channelId: targetType === "channel" ? targetId : null,
        conversationId: targetType === "dm" ? targetId : null,
        presenceManager: getPresenceManager(),
        workspaceId,
      }).catch((err) => {
        console.error("[Message] Error creating notifications:", err);
      });
    }

    // Notify members of unread count increment
    const unreadManager = getUnreadManager();
    if (unreadManager) {
      if (targetType === "channel") {
        unreadManager.notifyUnreadIncrement(targetId, userId, newMessage.sequence).catch((err) => {
          console.error("[Message] Error notifying unread increment:", err);
        });
      } else {
        unreadManager.notifyConversationUnreadIncrement(targetId, userId, newMessage.sequence).catch((err) => {
          console.error("[Message] Error notifying conversation unread increment:", err);
        });
      }
    }

    // Notify workspace-level unread count update
    const workspaceUnreadManager = getWorkspaceUnreadManager();
    if (workspaceUnreadManager) {
      // Get workspaceId from channel or conversation
      let workspaceId: string | undefined;
      if (targetType === "channel") {
        const [channelData] = await db
          .select({ organizationId: channels.organizationId })
          .from(channels)
          .where(eq(channels.id, targetId))
          .limit(1);
        workspaceId = channelData?.organizationId;
      } else {
        const [convData] = await db
          .select({ organizationId: conversations.organizationId })
          .from(conversations)
          .where(eq(conversations.id, targetId))
          .limit(1);
        workspaceId = convData?.organizationId;
      }

      if (workspaceId) {
        // Get all members of the workspace
        const workspaceMembers = await db
          .select({ userId: members.userId })
          .from(members)
          .where(eq(members.organizationId, workspaceId));

        // Notify each member (except sender) of workspace unread update
        for (const member of workspaceMembers) {
          if (member.userId !== userId) {
            workspaceUnreadManager.notifyWorkspaceUnreadUpdate(member.userId, workspaceId).catch((err) => {
              console.error("[Message] Error notifying workspace unread update:", err);
            });
          }
        }
      }
    }

    // Send push notification for DMs
    if (targetType === "dm") {
      // Get all conversation participants except sender
      const participants = await db
        .select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, targetId));

      // Get conversation's workspace slug for URL building
      const [convData] = await db
        .select({
          organizationId: conversations.organizationId,
          workspaceSlug: organization.slug,
        })
        .from(conversations)
        .leftJoin(organization, eq(conversations.organizationId, organization.id))
        .where(eq(conversations.id, targetId))
        .limit(1);

      const workspaceSlug = convData?.workspaceSlug;

      for (const participant of participants) {
        // Don't notify sender of their own message
        if (participant.userId === userId) continue;

        const pushPayload: PushPayload = {
          title: author?.name
            ? `Message from ${author.name}`
            : "New direct message",
          body: newMessage.content.slice(0, 100),
          data: {
            url: workspaceSlug
              ? `/${workspaceSlug}/dm/${targetId}`
              : `/`,
            tag: `dm:${targetId}`,
            type: "dm",
            messageId: newMessage.id,
          },
        };

        // Fire and forget - don't block message handling
        sendPushToUser(participant.userId, pushPayload).catch((err) => {
          console.error("[Message] Error sending DM push:", err);
        });
      }
    }
  } catch (error) {
    console.error("[Message] Error sending message:", error);
    socket.emit("error", { message: "Failed to send message" });
    callback?.({ success: false });
  }
}

/**
 * Handle message:delete event.
 * Verifies ownership, soft deletes, and broadcasts deletion to room.
 */
async function handleDeleteMessage(
  socket: SocketWithData,
  io: SocketIOServer,
  data: { messageId: string }
): Promise<void> {
  const userId = socket.data.userId;
  const { messageId } = data;

  try {
    // Soft delete only if owned by user and not already deleted
    const result = await db
      .update(messages)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.authorId, userId),
          isNull(messages.deletedAt)
        )
      )
      .returning();

    if (result.length === 0) {
      socket.emit("error", { message: "Message not found or not authorized to delete" });
      return;
    }

    const deletedMessage = result[0];
    const deletedAt = deletedMessage.deletedAt!;

    // Determine room and broadcast deletion
    const roomName = deletedMessage.channelId
      ? getRoomName.channel(deletedMessage.channelId)
      : getRoomName.conversation(deletedMessage.conversationId!);

    io.to(roomName).emit("message:deleted", { messageId, deletedAt });

    console.log(`[Message] User ${userId} deleted message ${messageId}`);
  } catch (error) {
    console.error("[Message] Error deleting message:", error);
    socket.emit("error", { message: "Failed to delete message" });
  }
}

/**
 * Handle message:getOlder event for lazy loading older messages.
 * Used for infinite scroll when user scrolls up to load history.
 */
async function handleGetOlderMessages(
  socket: SocketWithData,
  data: {
    targetId: string;
    targetType: "channel" | "dm";
    cursor: number;
    limit?: number;
  },
  callback: (response: {
    success: boolean;
    messages?: Message[];
    hasMore?: boolean;
    nextCursor?: number;
    error?: string;
  }) => void
): Promise<void> {
  const userId = socket.data.userId;
  const { targetId, targetType, cursor, limit = 50 } = data;

  try {
    // Validate membership
    if (targetType === "channel") {
      const membership = await db
        .select()
        .from(channelMembers)
        .where(and(eq(channelMembers.channelId, targetId), eq(channelMembers.userId, userId)))
        .limit(1);

      if (membership.length === 0) {
        callback({ success: false, error: "Not a member of this channel" });
        return;
      }
    } else {
      const participation = await db
        .select()
        .from(conversationParticipants)
        .where(and(eq(conversationParticipants.conversationId, targetId), eq(conversationParticipants.userId, userId)))
        .limit(1);

      if (participation.length === 0) {
        callback({ success: false, error: "Not a participant in this conversation" });
        return;
      }
    }

    // Fetch messages with sequence < cursor, ordered DESC, limit + 1 to detect hasMore
    const fetchLimit = Math.min(limit, 100) + 1; // Cap at 100, +1 for hasMore detection
    const whereCondition = targetType === "channel"
      ? and(eq(messages.channelId, targetId), isNull(messages.deletedAt), isNull(messages.parentId), lt(messages.sequence, cursor))
      : and(eq(messages.conversationId, targetId), isNull(messages.deletedAt), isNull(messages.parentId), lt(messages.sequence, cursor));

    const olderMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        authorId: messages.authorId,
        channelId: messages.channelId,
        conversationId: messages.conversationId,
        parentId: messages.parentId,
        replyCount: messages.replyCount,
        sequence: messages.sequence,
        deletedAt: messages.deletedAt,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(messages)
      .leftJoin(users, eq(messages.authorId, users.id))
      .where(whereCondition)
      .orderBy(desc(messages.sequence))
      .limit(fetchLimit);

    // Check if there are more messages beyond our limit
    const hasMore = olderMessages.length > Math.min(limit, 100);
    const messagesToReturn = hasMore ? olderMessages.slice(0, -1) : olderMessages;

    // Fetch attachments for these messages
    const messageIds = messagesToReturn.map((m) => m.id);
    const attachmentsData = messageIds.length > 0
      ? await db
          .select({
            id: fileAttachments.id,
            messageId: fileAttachments.messageId,
            originalName: fileAttachments.originalName,
            path: fileAttachments.path,
            mimeType: fileAttachments.mimeType,
            sizeBytes: fileAttachments.sizeBytes,
            isImage: fileAttachments.isImage,
          })
          .from(fileAttachments)
          .where(inArray(fileAttachments.messageId, messageIds))
      : [];

    // Group attachments by messageId
    const attachmentsByMessageId = new Map<string, Attachment[]>();
    for (const a of attachmentsData) {
      if (a.messageId) {
        const existing = attachmentsByMessageId.get(a.messageId) || [];
        existing.push({
          id: a.id,
          originalName: a.originalName,
          path: a.path,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          isImage: a.isImage,
        });
        attachmentsByMessageId.set(a.messageId, existing);
      }
    }

    // Get organization ID for guest status lookup
    let organizationId: string | null = null;
    if (targetType === "channel") {
      const [channel] = await db
        .select({ organizationId: channels.organizationId })
        .from(channels)
        .where(eq(channels.id, targetId))
        .limit(1);
      organizationId = channel?.organizationId ?? null;
    } else {
      const [conv] = await db
        .select({ organizationId: conversations.organizationId })
        .from(conversations)
        .where(eq(conversations.id, targetId))
        .limit(1);
      organizationId = conv?.organizationId ?? null;
    }

    // Fetch guest status for message authors
    const uniqueAuthorIds = [...new Set(messagesToReturn.map((m) => m.authorId))];
    const guestStatusMap = new Map<string, boolean>();
    if (organizationId && uniqueAuthorIds.length > 0) {
      const guestMembers = await db
        .select({ odlUserId: members.userId, isGuest: members.isGuest })
        .from(members)
        .where(and(
          inArray(members.userId, uniqueAuthorIds),
          eq(members.organizationId, organizationId)
        ));
      for (const m of guestMembers) {
        guestStatusMap.set(m.odlUserId, m.isGuest ?? false);
      }
    }

    // Reverse to chronological order (oldest first) for client
    const formattedMessages: Message[] = messagesToReturn.reverse().map((m) => ({
      id: m.id,
      content: m.content,
      authorId: m.authorId,
      channelId: m.channelId,
      conversationId: m.conversationId,
      parentId: m.parentId,
      replyCount: m.replyCount,
      sequence: m.sequence,
      deletedAt: m.deletedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      author: {
        id: m.authorId,
        name: m.authorName,
        email: m.authorEmail || "",
        isGuest: guestStatusMap.get(m.authorId) ?? false,
      },
      attachments: attachmentsByMessageId.get(m.id),
    }));

    // Next cursor is the lowest sequence number in the returned set
    const nextCursor = formattedMessages.length > 0 ? formattedMessages[0].sequence : undefined;

    callback({
      success: true,
      messages: formattedMessages,
      hasMore,
      nextCursor,
    });

    console.log(`[Message] User ${userId} loaded ${formattedMessages.length} older messages for ${targetType}:${targetId}`);
  } catch (error) {
    console.error("[Message] Error loading older messages:", error);
    callback({ success: false, error: "Failed to load older messages" });
  }
}

/**
 * Register message event handlers on socket.
 */
export function handleMessageEvents(socket: SocketWithData, io: SocketIOServer): void {
  socket.on("message:send", (data, callback) => {
    handleSendMessage(socket, io, data, callback);
  });

  socket.on("message:delete", (data) => {
    handleDeleteMessage(socket, io, data);
  });

  socket.on("message:getOlder", (data, callback) => {
    handleGetOlderMessages(socket, data, callback);
  });
}

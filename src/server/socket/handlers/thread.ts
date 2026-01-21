import type { Server, Socket } from "socket.io";
import { db } from "@/db";
import { messages, threadParticipants, users } from "@/db/schema";
import { eq, and, isNull, sql, asc, gt } from "drizzle-orm";
import { getRoomName } from "../rooms";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, Message } from "@/lib/socket-events";
import { isChannelMember, isConversationParticipant, getMessageContext } from "../authz";

// M-3: Maximum message length validation (matching message.ts)
const MAX_MESSAGE_LENGTH = 10_000;

// M-11: Pagination constants for thread replies
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Handle thread:reply event.
 * Creates a reply to a parent message, preventing nested threading.
 */
async function handleThreadReply(
  socket: SocketWithData,
  io: SocketIOServer,
  data: { parentId: string; content: string },
  callback?: (response: { success: boolean; messageId?: string }) => void
): Promise<void> {
  const userId = socket.data.userId;
  const { parentId, content } = data;

  try {
    // M-3: Server-side length validation
    if (content.length > MAX_MESSAGE_LENGTH) {
      socket.emit("error", {
        message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH.toLocaleString()} characters`,
        code: "MESSAGE_TOO_LONG",
      });
      callback?.({ success: false });
      return;
    }

    // Get parent message and verify it exists and is not deleted
    const [parent] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, parentId), isNull(messages.deletedAt)))
      .limit(1);

    if (!parent) {
      socket.emit("error", { message: "Parent message not found" });
      callback?.({ success: false });
      return;
    }

    // Verify user has access to the channel/DM containing this thread
    if (parent.channelId) {
      const isMember = await isChannelMember(userId, parent.channelId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to reply in this channel" });
        callback?.({ success: false });
        return;
      }
    } else if (parent.conversationId) {
      const isParticipant = await isConversationParticipant(userId, parent.conversationId);
      if (!isParticipant) {
        socket.emit("error", { message: "Not authorized to reply in this conversation" });
        callback?.({ success: false });
        return;
      }
    }

    // Prevent nested threads: cannot reply to a reply
    if (parent.parentId !== null) {
      socket.emit("error", { message: "Cannot reply to a reply" });
      callback?.({ success: false });
      return;
    }

    // Determine which room the parent is in (channel or DM)
    const targetId = parent.channelId || parent.conversationId;
    const targetType = parent.channelId ? "channel" : "dm";

    if (!targetId) {
      socket.emit("error", { message: "Invalid parent message" });
      callback?.({ success: false });
      return;
    }

    // M-2: Atomic sequence generation with retry (matching message.ts pattern)
    const insertReplyWithRetry = async (retries = 3): Promise<typeof messages.$inferSelect> => {
      const condition = targetType === "channel"
        ? sql`channel_id = ${targetId}`
        : sql`conversation_id = ${targetId}`;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const [newMsg] = await db
            .insert(messages)
            .values({
              content,
              authorId: userId,
              channelId: parent.channelId,
              conversationId: parent.conversationId,
              parentId,
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
      throw new Error("Failed to insert reply after retries");
    };

    const newMessage = await insertReplyWithRetry();

    // Increment parent's replyCount
    await db
      .update(messages)
      .set({
        replyCount: sql`${messages.replyCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, parentId));

    // Upsert thread participant for current user
    await db
      .insert(threadParticipants)
      .values({
        threadId: parentId,
        userId,
      })
      .onConflictDoUpdate({
        target: [threadParticipants.threadId, threadParticipants.userId],
        set: {
          lastReadAt: new Date(),
        },
      });

    // Get author info for broadcast
    const [author] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));

    const messageWithAuthor: Message = {
      id: newMessage.id,
      content: newMessage.content,
      authorId: newMessage.authorId,
      channelId: newMessage.channelId,
      conversationId: newMessage.conversationId,
      parentId: newMessage.parentId,
      replyCount: 0,
      sequence: newMessage.sequence,
      deletedAt: newMessage.deletedAt,
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
      author: author ? { id: author.id, name: author.name, email: author.email } : undefined,
    };

    // Broadcast to thread room
    io.to(getRoomName.thread(parentId)).emit("thread:newReply", messageWithAuthor);

    // Broadcast reply count update to channel/DM room
    const mainRoomName = targetType === "channel"
      ? getRoomName.channel(targetId)
      : getRoomName.conversation(targetId);

    // Get updated reply count
    const [updatedParent] = await db
      .select({ replyCount: messages.replyCount })
      .from(messages)
      .where(eq(messages.id, parentId));

    io.to(mainRoomName).emit("message:replyCount", {
      messageId: parentId,
      replyCount: updatedParent?.replyCount ?? 1,
    });

    // Acknowledge success
    callback?.({ success: true, messageId: newMessage.id });

    console.log(`[Thread] User ${userId} replied to ${parentId} with ${newMessage.id}`);
  } catch (error) {
    console.error("[Thread] Error creating reply:", error);
    socket.emit("error", { message: "Failed to create reply" });
    callback?.({ success: false });
  }
}

/**
 * Handle thread:join event.
 * Joins socket to thread room for real-time updates.
 */
async function handleJoinThread(socket: SocketWithData, data: { threadId: string }): Promise<void> {
  const userId = socket.data.userId;

  // Get the message context to verify access
  const context = await getMessageContext(data.threadId);
  if (!context) {
    socket.emit("error", { message: "Thread not found" });
    return;
  }

  // Verify membership
  if (context.channelId) {
    const isMember = await isChannelMember(userId, context.channelId);
    if (!isMember) {
      socket.emit("error", { message: "Not authorized to view this thread" });
      return;
    }
  } else if (context.conversationId) {
    const isParticipant = await isConversationParticipant(userId, context.conversationId);
    if (!isParticipant) {
      socket.emit("error", { message: "Not authorized to view this thread" });
      return;
    }
  }

  socket.join(getRoomName.thread(data.threadId));
  console.log(`[Thread] User ${userId} joined thread: ${data.threadId}`);
}

/**
 * Handle thread:leave event.
 * Leaves socket from thread room.
 */
function handleLeaveThread(socket: SocketWithData, data: { threadId: string }): void {
  socket.leave(getRoomName.thread(data.threadId));
  console.log(`[Thread] User ${socket.data.userId} left thread: ${data.threadId}`);
}

/**
 * Handle thread:getReplies event.
 * M-11: Fetches replies for a thread with pagination support.
 */
async function handleGetReplies(
  socket: SocketWithData,
  data: { threadId: string; limit?: number; cursor?: number },
  callback: (response: { success: boolean; replies?: Message[]; hasMore?: boolean; nextCursor?: number }) => void
): Promise<void> {
  const userId = socket.data.userId;

  try {
    // Get the message context to verify access
    const context = await getMessageContext(data.threadId);
    if (!context) {
      callback({ success: false });
      return;
    }

    // Verify membership
    if (context.channelId) {
      const isMember = await isChannelMember(userId, context.channelId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to view this thread" });
        callback({ success: false });
        return;
      }
    } else if (context.conversationId) {
      const isParticipant = await isConversationParticipant(userId, context.conversationId);
      if (!isParticipant) {
        socket.emit("error", { message: "Not authorized to view this thread" });
        callback({ success: false });
        return;
      }
    }

    // M-11: Clamp limit to prevent abuse
    const requestedLimit = data.limit ?? DEFAULT_PAGE_SIZE;
    const safeLimit = Math.min(Math.max(1, requestedLimit), MAX_PAGE_SIZE);

    // Build where conditions
    const whereConditions = [
      eq(messages.parentId, data.threadId),
      isNull(messages.deletedAt),
    ];

    // Add cursor condition if provided
    if (data.cursor !== undefined) {
      whereConditions.push(gt(messages.sequence, data.cursor));
    }

    // Fetch one extra to detect hasMore
    const replies = await db
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
      .where(and(...whereConditions))
      .orderBy(asc(messages.sequence))
      .limit(safeLimit + 1);

    // Determine if there are more results
    const hasMore = replies.length > safeLimit;
    const items = hasMore ? replies.slice(0, safeLimit) : replies;
    const nextCursor = hasMore ? items[items.length - 1]?.sequence : undefined;

    const formattedReplies: Message[] = items.map((r) => ({
      id: r.id,
      content: r.content,
      authorId: r.authorId,
      channelId: r.channelId,
      conversationId: r.conversationId,
      parentId: r.parentId,
      replyCount: r.replyCount,
      sequence: r.sequence,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: {
        id: r.authorId,
        name: r.authorName,
        email: r.authorEmail || "",
      },
    }));

    callback({ success: true, replies: formattedReplies, hasMore, nextCursor });
  } catch (error) {
    console.error("[Thread] Error fetching replies:", error);
    callback({ success: false });
  }
}

/**
 * Register thread event handlers on socket.
 */
export function handleThreadEvents(socket: SocketWithData, io: SocketIOServer): void {
  socket.on("thread:reply", (data, callback) => {
    handleThreadReply(socket, io, data, callback);
  });

  socket.on("thread:join", async (data) => {
    await handleJoinThread(socket, data);
  });

  socket.on("thread:leave", (data) => {
    handleLeaveThread(socket, data);
  });

  socket.on("thread:getReplies", (data, callback) => {
    handleGetReplies(socket, data, callback);
  });
}

import type { Server, Socket } from "socket.io";
import { db } from "@/db";
import { notifications, users, channelMembers, channels, channelNotificationSettings, members } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getRoomName } from "../rooms";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, Message, Notification } from "@/lib/socket-events";
import type { ParsedMention } from "@/lib/mentions";
import type { PresenceManager } from "./presence";
import type { NotificationMode } from "@/db/schema/channel-notification-settings";
import { sendPushToUser, type PushPayload } from "@/lib/push";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Check if a user should receive a notification for a mention.
 * Returns true if notification should be created, false if filtered out.
 *
 * Rules:
 * - muted: No notifications at all
 * - mentions: Only direct @user mentions (not @channel/@here)
 * - all: All notifications (default)
 */
async function shouldNotify(
  userId: string,
  channelId: string,
  mentionType: "user" | "channel" | "here"
): Promise<boolean> {
  // Query user's notification settings for this channel
  const settings = await db.query.channelNotificationSettings.findFirst({
    where: and(
      eq(channelNotificationSettings.channelId, channelId),
      eq(channelNotificationSettings.userId, userId)
    ),
  });

  // No settings = "all" mode (default)
  const mode: NotificationMode = (settings?.mode as NotificationMode) ?? "all";

  switch (mode) {
    case "muted":
      // No notifications at all
      return false;
    case "mentions":
      // Only direct @user mentions
      return mentionType === "user";
    case "all":
    default:
      // All notifications
      return true;
  }
}

/**
 * Create notifications for mentions in a message.
 * Called by message handler after successful message save.
 */
export async function createNotifications(params: {
  io: SocketIOServer;
  message: Message;
  mentions: ParsedMention[];
  senderId: string;
  channelId?: string | null;
  conversationId?: string | null;
  presenceManager: PresenceManager | null;
  workspaceId?: string;
}): Promise<void> {
  const { io, message, mentions, senderId, channelId, conversationId, presenceManager, workspaceId } = params;

  if (mentions.length === 0) return;

  const contentPreview = message.content.slice(0, 100);
  const notificationsToCreate: Array<{
    userId: string;
    type: "mention" | "channel" | "here";
    messageId: string;
    channelId: string | null;
    conversationId: string | null;
    actorId: string;
    content: string;
  }> = [];

  // Track notified users to avoid duplicates
  const notifiedUserIds = new Set<string>();

  // Get channel name and slug if in channel context
  let channelName: string | undefined;
  let channelSlug: string | undefined;
  if (channelId) {
    const [channelData] = await db
      .select({ name: channels.name, slug: channels.slug })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);
    channelName = channelData?.name;
    channelSlug = channelData?.slug;
  }

  for (const mention of mentions) {
    if (mention.type === "user") {
      // SECFIX-01: Scope user lookup to organization
      let targetUser: { id: string } | undefined;

      if (workspaceId) {
        // Channel context - require org membership
        const [result] = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(members, eq(members.userId, users.id))
          .where(
            and(
              eq(users.name, mention.value),
              eq(members.organizationId, workspaceId)
            )
          )
          .limit(1);
        targetUser = result;
      } else if (conversationId) {
        // DM context - lookup by name (DMs are already scoped to conversation participants)
        const [result] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.name, mention.value))
          .limit(1);
        targetUser = result;
      }

      if (targetUser && targetUser.id !== senderId && !notifiedUserIds.has(targetUser.id)) {
        // Check notification settings if in channel context
        if (channelId) {
          const allowed = await shouldNotify(targetUser.id, channelId, "user");
          if (!allowed) continue;
        }

        notifiedUserIds.add(targetUser.id);
        notificationsToCreate.push({
          userId: targetUser.id,
          type: "mention",
          messageId: message.id,
          channelId: channelId ?? null,
          conversationId: conversationId ?? null,
          actorId: senderId,
          content: contentPreview,
        });
      }
    } else if (mention.type === "channel" && channelId) {
      // Notify all channel members except sender
      const members = await db
        .select({ userId: channelMembers.userId })
        .from(channelMembers)
        .where(eq(channelMembers.channelId, channelId));

      for (const member of members) {
        if (member.userId !== senderId && !notifiedUserIds.has(member.userId)) {
          // Check notification settings
          const allowed = await shouldNotify(member.userId, channelId, "channel");
          if (!allowed) continue;

          notifiedUserIds.add(member.userId);
          notificationsToCreate.push({
            userId: member.userId,
            type: "channel",
            messageId: message.id,
            channelId,
            conversationId: null,
            actorId: senderId,
            content: contentPreview,
          });
        }
      }
    } else if (mention.type === "here" && channelId) {
      // Notify only active channel members except sender
      const members = await db
        .select({ userId: channelMembers.userId })
        .from(channelMembers)
        .where(eq(channelMembers.channelId, channelId));

      for (const member of members) {
        if (member.userId !== senderId && !notifiedUserIds.has(member.userId)) {
          // Check if user is active
          if (presenceManager && workspaceId) {
            const status = await presenceManager.getStatus(member.userId, workspaceId);
            if (status !== "active") continue;
          }

          // Check notification settings
          const allowed = await shouldNotify(member.userId, channelId, "here");
          if (!allowed) continue;

          notifiedUserIds.add(member.userId);
          notificationsToCreate.push({
            userId: member.userId,
            type: "here",
            messageId: message.id,
            channelId,
            conversationId: null,
            actorId: senderId,
            content: contentPreview,
          });
        }
      }
    }
  }

  if (notificationsToCreate.length === 0) return;

  // Batch insert notifications
  const insertedNotifications = await db
    .insert(notifications)
    .values(notificationsToCreate)
    .returning();

  // Get actor info for emitting
  const [actor] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, senderId));

  // Emit notification:new to each user's room and send push
  for (const notification of insertedNotifications) {
    const notificationPayload: Notification = {
      id: notification.id,
      type: notification.type as "mention" | "channel" | "here",
      messageId: notification.messageId,
      channelId: notification.channelId,
      channelSlug,
      conversationId: notification.conversationId,
      actorId: notification.actorId,
      actorName: actor?.name ?? null,
      content: notification.content,
      channelName,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };

    io.to(getRoomName.user(notification.userId)).emit("notification:new", notificationPayload);

    // Send push notification for mentions
    // Build push payload
    const pushPayload: PushPayload = {
      title: actor?.name
        ? `${actor.name} mentioned you`
        : "New mention",
      body: notification.content,
      data: {
        url: notification.channelId && channelSlug
          ? `/workspace/${workspaceId}/channels/${channelSlug}`
          : notification.conversationId
            ? `/workspace/${workspaceId}/dm/${notification.conversationId}`
            : "/",
        tag: notification.channelId
          ? `channel:${notification.channelId}`
          : `dm:${notification.conversationId}`,
        type: notification.type as "mention" | "channel" | "here",
        messageId: notification.messageId ?? undefined,
      },
    };

    // Send push (fire and forget - don't block socket emit)
    sendPushToUser(notification.userId, pushPayload).catch((err) => {
      console.error("[Notification] Error sending push:", err);
    });
  }

  console.log(`[Notification] Created ${insertedNotifications.length} notifications for message ${message.id}`);
}

/**
 * Handle notification socket events.
 */
export function handleNotificationEvents(socket: SocketWithData, io: SocketIOServer): void {
  const userId = socket.data.userId;

  // Fetch notifications
  socket.on("notification:fetch", async (data, callback) => {
    const limit = data.limit ?? 50;

    try {
      // Get notifications with actor info
      const notificationRows = await db
        .select({
          id: notifications.id,
          type: notifications.type,
          messageId: notifications.messageId,
          channelId: notifications.channelId,
          conversationId: notifications.conversationId,
          actorId: notifications.actorId,
          content: notifications.content,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
          actorName: users.name,
        })
        .from(notifications)
        .leftJoin(users, eq(notifications.actorId, users.id))
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      // Get channel names and slugs for notifications in channels
      const channelIds = [...new Set(notificationRows.filter(n => n.channelId).map(n => n.channelId!))];
      const channelDataMap = new Map<string, { name: string; slug: string }>();

      if (channelIds.length > 0) {
        // Fetch all channels in one query using individual fetches
        for (const chId of channelIds) {
          const [ch] = await db
            .select({ id: channels.id, name: channels.name, slug: channels.slug })
            .from(channels)
            .where(eq(channels.id, chId));
          if (ch) channelDataMap.set(ch.id, { name: ch.name, slug: ch.slug });
        }
      }

      const notificationList: Notification[] = notificationRows.map(n => {
        const channelData = n.channelId ? channelDataMap.get(n.channelId) : undefined;
        return {
          id: n.id,
          type: n.type as "mention" | "channel" | "here" | "thread_reply",
          messageId: n.messageId,
          channelId: n.channelId,
          channelSlug: channelData?.slug,
          conversationId: n.conversationId,
          actorId: n.actorId,
          actorName: n.actorName,
          content: n.content,
          channelName: channelData?.name,
          readAt: n.readAt,
          createdAt: n.createdAt,
        };
      });

      // Count unread
      const unreadCount = notificationList.filter(n => !n.readAt).length;

      callback({ notifications: notificationList, unreadCount });
    } catch (error) {
      console.error("[Notification] Error fetching notifications:", error);
      callback({ notifications: [], unreadCount: 0 });
    }
  });

  // Mark single notification as read
  socket.on("notification:markRead", async (data) => {
    const { notificationId } = data;

    try {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

      // Emit confirmation back to user's devices
      io.to(getRoomName.user(userId)).emit("notification:read", { notificationId });

      console.log(`[Notification] User ${userId} marked notification ${notificationId} as read`);
    } catch (error) {
      console.error("[Notification] Error marking notification as read:", error);
    }
  });

  // Mark all notifications as read
  socket.on("notification:markAllRead", async () => {
    try {
      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

      // Emit confirmation back to user's devices
      io.to(getRoomName.user(userId)).emit("notification:readAll");

      console.log(`[Notification] User ${userId} marked all notifications as read`);
    } catch (error) {
      console.error("[Notification] Error marking all notifications as read:", error);
    }
  });
}

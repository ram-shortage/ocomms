import type { Server, Socket } from "socket.io";
import { db } from "@/db";
import { messages, channelMembers, conversationParticipants, channels } from "@/db/schema";
import { eq, and, isNull, sql, max } from "drizzle-orm";
import { getRoomName } from "../rooms";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, Message } from "@/lib/socket-events";
import { users } from "@/db/schema";
import { parseMentions } from "@/lib/mentions";
import { createNotifications } from "./notification";
import { getPresenceManager, getUnreadManager } from "../index";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Handle message:send event.
 * Validates membership, generates sequence number, persists message, and broadcasts to room.
 */
async function handleSendMessage(
  socket: SocketWithData,
  io: SocketIOServer,
  data: { targetId: string; targetType: "channel" | "dm"; content: string },
  callback?: (response: { success: boolean; messageId?: string }) => void
): Promise<void> {
  const userId = socket.data.userId;
  const { targetId, targetType, content } = data;

  try {
    // Validate membership
    if (targetType === "channel") {
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

    // Get next sequence number
    const condition = targetType === "channel"
      ? eq(messages.channelId, targetId)
      : eq(messages.conversationId, targetId);

    const [maxSeq] = await db
      .select({ maxSequence: max(messages.sequence) })
      .from(messages)
      .where(condition);

    const sequence = (maxSeq?.maxSequence ?? 0) + 1;

    // Insert message
    const [newMessage] = await db
      .insert(messages)
      .values({
        content,
        authorId: userId,
        channelId: targetType === "channel" ? targetId : null,
        conversationId: targetType === "dm" ? targetId : null,
        sequence,
      })
      .returning();

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
      sequence: newMessage.sequence,
      deletedAt: newMessage.deletedAt,
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
      author: author ? { id: author.id, name: author.name, email: author.email } : undefined,
    };

    // Broadcast to room
    const roomName = targetType === "channel"
      ? getRoomName.channel(targetId)
      : getRoomName.conversation(targetId);

    io.to(roomName).emit("message:new", messageWithAuthor);

    // Acknowledge success
    callback?.({ success: true, messageId: newMessage.id });

    console.log(`[Message] User ${userId} sent message ${newMessage.id} to ${targetType}:${targetId}`);

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
        unreadManager.notifyUnreadIncrement(targetId, userId, sequence).catch((err) => {
          console.error("[Message] Error notifying unread increment:", err);
        });
      } else {
        unreadManager.notifyConversationUnreadIncrement(targetId, userId, sequence).catch((err) => {
          console.error("[Message] Error notifying conversation unread increment:", err);
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
 * Register message event handlers on socket.
 */
export function handleMessageEvents(socket: SocketWithData, io: SocketIOServer): void {
  socket.on("message:send", (data, callback) => {
    handleSendMessage(socket, io, data, callback);
  });

  socket.on("message:delete", (data) => {
    handleDeleteMessage(socket, io, data);
  });
}

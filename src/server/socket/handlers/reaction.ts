import type { Server, Socket } from "socket.io";
import { db } from "@/db";
import { reactions, messages, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getRoomName } from "../rooms";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, ReactionGroup } from "@/lib/socket-events";
import { isChannelMember, isConversationParticipant, getMessageContext } from "../authz";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Handle reaction:toggle event.
 * Adds reaction if not exists, removes if exists (toggle behavior).
 * Broadcasts update to appropriate room.
 */
async function handleReactionToggle(
  socket: SocketWithData,
  io: SocketIOServer,
  data: { messageId: string; emoji: string }
): Promise<void> {
  const userId = socket.data.userId;
  const userName = socket.data.user?.name || socket.data.user?.email || "Unknown";
  const { messageId, emoji } = data;

  try {
    // Verify user has access to the message's channel/DM
    const context = await getMessageContext(messageId);
    if (!context) {
      socket.emit("error", { message: "Message not found" });
      return;
    }

    if (context.channelId) {
      const isMember = await isChannelMember(userId, context.channelId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to react to this message" });
        return;
      }
    } else if (context.conversationId) {
      const isParticipant = await isConversationParticipant(userId, context.conversationId);
      if (!isParticipant) {
        socket.emit("error", { message: "Not authorized to react to this message" });
        return;
      }
    }

    // Check if reaction already exists
    const existing = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.messageId, messageId),
          eq(reactions.userId, userId),
          eq(reactions.emoji, emoji)
        )
      )
      .limit(1);

    let action: "added" | "removed";

    if (existing.length > 0) {
      // Remove existing reaction
      await db
        .delete(reactions)
        .where(
          and(
            eq(reactions.messageId, messageId),
            eq(reactions.userId, userId),
            eq(reactions.emoji, emoji)
          )
        );
      action = "removed";
    } else {
      // Add new reaction (onConflictDoNothing for race condition safety)
      await db
        .insert(reactions)
        .values({
          messageId,
          userId,
          emoji,
        })
        .onConflictDoNothing();
      action = "added";
    }

    // Determine room name using already-fetched context
    const roomName = context.channelId
      ? getRoomName.channel(context.channelId)
      : getRoomName.conversation(context.conversationId!);

    // Broadcast reaction update to room
    io.to(roomName).emit("reaction:update", {
      messageId,
      emoji,
      userId,
      userName,
      action,
    });

    console.log(`[Reaction] User ${userId} ${action} ${emoji} on message ${messageId}`);
  } catch (error) {
    console.error("[Reaction] Error toggling reaction:", error);
    socket.emit("error", { message: "Failed to toggle reaction" });
  }
}

/**
 * Handle reaction:get event.
 * Returns grouped reactions with user info for a message.
 */
async function handleGetReactions(
  socket: SocketWithData,
  data: { messageId: string },
  callback: (response: { success: boolean; reactions?: ReactionGroup[] }) => void
): Promise<void> {
  const { messageId } = data;

  try {
    // Query reactions grouped by emoji with user info
    const result = await db
      .select({
        emoji: reactions.emoji,
        userId: reactions.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(reactions)
      .innerJoin(users, eq(reactions.userId, users.id))
      .where(eq(reactions.messageId, messageId));

    // Group by emoji
    const grouped = new Map<string, { userIds: string[]; userNames: string[] }>();

    for (const row of result) {
      if (!grouped.has(row.emoji)) {
        grouped.set(row.emoji, { userIds: [], userNames: [] });
      }
      const group = grouped.get(row.emoji)!;
      group.userIds.push(row.userId);
      group.userNames.push(row.userName || row.userEmail);
    }

    // Convert to ReactionGroup array
    const reactionGroups: ReactionGroup[] = [];
    for (const [emoji, { userIds, userNames }] of grouped) {
      reactionGroups.push({
        emoji,
        count: userIds.length,
        userIds,
        userNames,
      });
    }

    callback({ success: true, reactions: reactionGroups });
  } catch (error) {
    console.error("[Reaction] Error getting reactions:", error);
    callback({ success: false });
  }
}

/**
 * Register reaction event handlers on socket.
 */
export function handleReactionEvents(socket: SocketWithData, io: SocketIOServer): void {
  socket.on("reaction:toggle", (data) => {
    handleReactionToggle(socket, io, data);
  });

  socket.on("reaction:get", (data, callback) => {
    handleGetReactions(socket, data, callback);
  });
}

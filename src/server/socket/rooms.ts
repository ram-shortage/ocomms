import type { Socket } from "socket.io";
import { db } from "@/db";
import { channelMembers } from "@/db/schema/channel";
import { conversationParticipants } from "@/db/schema/conversation";
import { eq } from "drizzle-orm";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";

type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Room naming conventions for Socket.IO rooms.
 * Consistent naming ensures proper message routing.
 */
export const getRoomName = {
  /** Channel room for channel messages */
  channel: (channelId: string) => `channel:${channelId}`,
  /** Conversation room for DM messages */
  conversation: (conversationId: string) => `dm:${conversationId}`,
  /** Workspace room for workspace-wide events (presence) */
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  /** User room for user-specific events */
  user: (userId: string) => `user:${userId}`,
};

/**
 * Join a user to all their authorized rooms on connection.
 * This includes their personal room, channel memberships, and DM conversations.
 */
export async function joinUserRooms(socket: SocketWithData): Promise<void> {
  const userId = socket.data.userId;

  // Always join user's personal room for user-specific events
  socket.join(getRoomName.user(userId));

  // Fetch and join user's channel memberships
  const memberships = await db
    .select({ channelId: channelMembers.channelId })
    .from(channelMembers)
    .where(eq(channelMembers.userId, userId));

  for (const membership of memberships) {
    socket.join(getRoomName.channel(membership.channelId));
  }

  // Fetch and join user's DM conversations
  const conversations = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));

  for (const conv of conversations) {
    socket.join(getRoomName.conversation(conv.conversationId));
  }

  console.log(
    `[Socket.IO] User ${userId} joined ${memberships.length} channels and ${conversations.length} conversations`
  );
}

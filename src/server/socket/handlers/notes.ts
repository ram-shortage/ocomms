import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";
import { isChannelMember, isOrganizationMember } from "../authz";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Get the room name for a channel note subscription.
 */
function getNoteChannelRoom(channelId: string): string {
  return `note:channel:${channelId}`;
}

/**
 * Get the room name for a personal note subscription.
 */
function getNotePersonalRoom(userId: string, workspaceId: string): string {
  return `note:personal:${userId}:${workspaceId}`;
}

/**
 * Register note event handlers on socket.
 * Handles note:subscribe and note:unsubscribe events.
 */
export function registerNoteHandlers(io: SocketIOServer, socket: TypedSocket): void {
  const userId = socket.data.userId;

  // Handle note:subscribe
  socket.on("note:subscribe", async (data) => {
    const { channelId, workspaceId } = data;

    if (channelId) {
      // Verify channel membership before subscribing
      const isMember = await isChannelMember(userId, channelId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to subscribe to channel notes" });
        return;
      }
      const room = getNoteChannelRoom(channelId);
      socket.join(room);
      console.log(`[Notes] User ${userId} subscribed to channel note room: ${room}`);
    }

    if (workspaceId) {
      // Verify organization membership for personal notes
      const isMember = await isOrganizationMember(userId, workspaceId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to subscribe to workspace notes" });
        return;
      }
      const room = getNotePersonalRoom(userId, workspaceId);
      socket.join(room);
      console.log(`[Notes] User ${userId} subscribed to personal note room: ${room}`);
    }
  });

  // Handle note:unsubscribe
  socket.on("note:unsubscribe", (data) => {
    const { channelId, workspaceId } = data;

    if (channelId) {
      const room = getNoteChannelRoom(channelId);
      socket.leave(room);
      console.log(`[Notes] User ${userId} unsubscribed from channel note room: ${room}`);
    }

    if (workspaceId) {
      const room = getNotePersonalRoom(userId, workspaceId);
      socket.leave(room);
      console.log(`[Notes] User ${userId} unsubscribed from personal note room: ${room}`);
    }
  });

  // Handle note:broadcast - client requests server to broadcast update to room
  socket.on("note:broadcast", async (data) => {
    const { channelId, workspaceId, version, userName } = data;

    if (channelId) {
      // Verify channel membership before broadcasting
      const isMember = await isChannelMember(userId, channelId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to broadcast to channel notes" });
        return;
      }
      const room = getNoteChannelRoom(channelId);
      // Broadcast to room except sender
      socket.to(room).emit("note:updated", {
        channelId,
        version,
        updatedBy: userId,
        updatedByName: userName,
      });
      console.log(`[Notes] User ${userId} broadcast update to channel note room: ${room}`);
    }

    if (workspaceId) {
      // Verify organization membership for personal notes
      const isMember = await isOrganizationMember(userId, workspaceId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to broadcast to workspace notes" });
        return;
      }
      // Personal notes - broadcast to user's own room (other devices)
      const room = getNotePersonalRoom(userId, workspaceId);
      socket.to(room).emit("note:updated", {
        workspaceId,
        version,
        updatedBy: userId,
        updatedByName: userName,
      });
      console.log(`[Notes] User ${userId} broadcast update to personal note room: ${room}`);
    }
  });
}

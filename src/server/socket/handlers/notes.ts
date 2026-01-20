import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";

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
  socket.on("note:subscribe", (data) => {
    const { channelId, workspaceId } = data;

    if (channelId) {
      const room = getNoteChannelRoom(channelId);
      socket.join(room);
      console.log(`[Notes] User ${userId} subscribed to channel note room: ${room}`);
    }

    if (workspaceId) {
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
  socket.on("note:broadcast", (data) => {
    const { channelId, workspaceId, version, userName } = data;

    if (channelId) {
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

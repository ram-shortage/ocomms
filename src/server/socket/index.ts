import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";
import { authMiddleware } from "./middleware/auth";
import { joinUserRooms, getRoomName } from "./rooms";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Setup Socket.IO event handlers.
 * Configures authentication middleware and connection handling.
 */
export function setupSocketHandlers(io: SocketIOServer) {
  // Apply authentication middleware
  io.use(authMiddleware);

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    console.log(`[Socket.IO] Client connected: ${socket.id} (user: ${userId})`);

    // Join user to their authorized rooms
    try {
      await joinUserRooms(socket);
    } catch (error) {
      console.error(`[Socket.IO] Error joining rooms for user ${userId}:`, error);
    }

    // Handle room:join for dynamic room joining (e.g., when user joins new channel)
    socket.on("room:join", (data) => {
      const roomName = data.roomType === "channel"
        ? getRoomName.channel(data.roomId)
        : getRoomName.conversation(data.roomId);
      socket.join(roomName);
      console.log(`[Socket.IO] User ${userId} joined room: ${roomName}`);
    });

    // Handle room:leave for dynamic room leaving
    socket.on("room:leave", (data) => {
      const roomName = data.roomType === "channel"
        ? getRoomName.channel(data.roomId)
        : getRoomName.conversation(data.roomId);
      socket.leave(roomName);
      console.log(`[Socket.IO] User ${userId} left room: ${roomName}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (user: ${userId}, reason: ${reason})`);
      // Note: Presence cleanup will be handled in plan 03
    });
  });
}

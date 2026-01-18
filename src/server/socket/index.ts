import type { Server, Socket } from "socket.io";
import type { Redis } from "ioredis";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";
import { authMiddleware } from "./middleware/auth";
import { joinUserRooms, getRoomName } from "./rooms";
import { setupPresence, handlePresenceEvents, type PresenceManager } from "./handlers/presence";
import { handleMessageEvents } from "./handlers/message";
import { handleReactionEvents } from "./handlers/reaction";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Extend socket type for presence heartbeat function
interface SocketWithPresence extends TypedSocket {
  startPresenceHeartbeat?: () => void;
}

// Module-level presence manager (set during setup)
let presenceManager: PresenceManager | null = null;

/**
 * Get the presence manager instance.
 * Returns null if Redis is not configured.
 */
export function getPresenceManager(): PresenceManager | null {
  return presenceManager;
}

/**
 * Setup Socket.IO event handlers.
 * Configures authentication middleware and connection handling.
 *
 * @param io - Socket.IO server instance
 * @param redis - Optional Redis client for presence (null = no presence features)
 */
export function setupSocketHandlers(io: SocketIOServer, redis?: Redis | null) {
  // Setup presence manager if Redis is available
  if (redis) {
    presenceManager = setupPresence(io, redis);
    console.log("[Socket.IO] Presence manager initialized with Redis");
  } else {
    console.log("[Socket.IO] Presence features disabled (no Redis)");
  }

  // Apply authentication middleware
  io.use(authMiddleware);

  io.on("connection", async (socket: SocketWithPresence) => {
    const userId = socket.data.userId;
    console.log(`[Socket.IO] Client connected: ${socket.id} (user: ${userId})`);

    // Setup presence event handlers if available
    if (presenceManager) {
      handlePresenceEvents(socket, io, presenceManager);
    }

    // Setup message event handlers
    handleMessageEvents(socket, io);

    // Setup reaction event handlers
    handleReactionEvents(socket, io);

    // Join user to their authorized rooms
    try {
      await joinUserRooms(socket);
    } catch (error) {
      console.error(`[Socket.IO] Error joining rooms for user ${userId}:`, error);
    }

    // Handle room:join for dynamic room joining (e.g., when user joins new channel)
    socket.on("room:join", async (data) => {
      const roomName = data.roomType === "channel"
        ? getRoomName.channel(data.roomId)
        : getRoomName.conversation(data.roomId);
      socket.join(roomName);
      console.log(`[Socket.IO] User ${userId} joined room: ${roomName}`);
    });

    // Handle workspace:join for joining workspace room and starting presence
    socket.on("workspace:join", async (data) => {
      const { workspaceId } = data;

      // Store workspaceId in socket data for presence handlers
      socket.data.workspaceId = workspaceId;

      // Join workspace room for presence broadcasts
      socket.join(getRoomName.workspace(workspaceId));
      console.log(`[Socket.IO] User ${userId} joined workspace: ${workspaceId}`);

      // Set user as online and start presence heartbeat
      if (presenceManager) {
        await presenceManager.setOnline(userId, workspaceId);
        socket.startPresenceHeartbeat?.();
      }
    });

    // Handle presence:fetch for getting multiple users' presence
    socket.on("presence:fetch", async (data, callback) => {
      if (!presenceManager) {
        // Return all offline if no presence manager
        const offlineMap: Record<string, "active" | "away" | "offline"> = {};
        for (const userId of data.userIds) {
          offlineMap[userId] = "offline";
        }
        callback(offlineMap);
        return;
      }

      const presenceMap = await presenceManager.getWorkspacePresence(
        data.workspaceId,
        data.userIds
      );
      callback(presenceMap);
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
      // Presence cleanup is handled by handlePresenceEvents disconnect handler
    });
  });
}

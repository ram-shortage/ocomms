import type { Server, Socket } from "socket.io";
import type { Redis } from "ioredis";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";
import { authMiddleware } from "./middleware/auth";
import { joinUserRooms, getRoomName } from "./rooms";
import { setupPresence, handlePresenceEvents, type PresenceManager } from "./handlers/presence";
import { handleMessageEvents } from "./handlers/message";
import { handleReactionEvents } from "./handlers/reaction";
import { handleThreadEvents } from "./handlers/thread";
import { handleNotificationEvents } from "./handlers/notification";
import { setupUnreadHandlers, handleUnreadEvents, type UnreadManager } from "./handlers/unread";
import { registerNoteHandlers } from "./handlers/notes";
import { handleTypingEvents } from "./handlers/typing";
import { isChannelMember, isConversationParticipant, isOrganizationMember } from "./authz";
import { auditLog, AuditEventType } from "@/lib/audit-logger";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Maximum IDs allowed per presence fetch request to prevent DoS
const MAX_IDS_PER_REQUEST = 100;

// Extend socket type for presence heartbeat function
interface SocketWithPresence extends TypedSocket {
  startPresenceHeartbeat?: () => void;
}

// Module-level presence manager (set during setup)
let presenceManager: PresenceManager | null = null;

// Module-level unread manager (always available)
let unreadManager: UnreadManager | null = null;

/**
 * Get the presence manager instance.
 * Returns null if Redis is not configured.
 */
export function getPresenceManager(): PresenceManager | null {
  return presenceManager;
}

/**
 * Get the unread manager instance.
 * Returns null only before setupSocketHandlers is called.
 */
export function getUnreadManager(): UnreadManager | null {
  return unreadManager;
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

  // Setup unread manager (works with or without Redis)
  unreadManager = setupUnreadHandlers(io, redis ?? null);
  console.log("[Socket.IO] Unread manager initialized");

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

    // Setup thread event handlers
    handleThreadEvents(socket, io);

    // Setup notification event handlers
    handleNotificationEvents(socket, io);

    // Setup unread event handlers
    if (unreadManager) {
      handleUnreadEvents(socket, io, unreadManager);
    }

    // Setup note event handlers
    registerNoteHandlers(io, socket);

    // Setup typing indicator event handlers
    handleTypingEvents(socket, io);

    // Join user to their authorized rooms
    try {
      await joinUserRooms(socket);
    } catch (error) {
      console.error(`[Socket.IO] Error joining rooms for user ${userId}:`, error);
    }

    // Handle room:join for dynamic room joining (e.g., when user joins new channel)
    socket.on("room:join", async (data) => {
      // Validate membership before joining room
      if (data.roomType === "channel") {
        const isMember = await isChannelMember(userId, data.roomId);
        if (!isMember) {
          socket.emit("error", { message: "Not authorized to join this channel" });
          console.log(`[Socket.IO] Unauthorized room:join attempt: user ${userId} -> channel ${data.roomId}`);
          auditLog({
            eventType: AuditEventType.AUTHZ_FAILURE,
            userId,
            details: {
              action: "room:join",
              resourceType: "channel",
              resourceId: data.roomId,
            },
          });
          return;
        }
      } else {
        const isParticipant = await isConversationParticipant(userId, data.roomId);
        if (!isParticipant) {
          socket.emit("error", { message: "Not authorized to join this conversation" });
          console.log(`[Socket.IO] Unauthorized room:join attempt: user ${userId} -> dm ${data.roomId}`);
          auditLog({
            eventType: AuditEventType.AUTHZ_FAILURE,
            userId,
            details: {
              action: "room:join",
              resourceType: "conversation",
              resourceId: data.roomId,
            },
          });
          return;
        }
      }

      const roomName = data.roomType === "channel"
        ? getRoomName.channel(data.roomId)
        : getRoomName.conversation(data.roomId);
      socket.join(roomName);
      console.log(`[Socket.IO] User ${userId} joined room: ${roomName}`);
    });

    // Handle workspace:join for joining workspace room and starting presence
    socket.on("workspace:join", async (data) => {
      const { workspaceId } = data;

      // Validate organization membership before joining workspace
      const isMember = await isOrganizationMember(userId, workspaceId);
      if (!isMember) {
        socket.emit("error", { message: "Not authorized to join this workspace" });
        console.log(`[Socket.IO] Unauthorized workspace:join attempt: user ${userId} -> workspace ${workspaceId}`);
        auditLog({
          eventType: AuditEventType.AUTHZ_FAILURE,
          userId,
          details: {
            action: "workspace:join",
            resourceType: "organization",
            resourceId: workspaceId,
          },
        });
        return;
      }

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
      // Cap array size to prevent DoS (M-12)
      if (data.userIds.length > MAX_IDS_PER_REQUEST) {
        socket.emit("error", {
          message: `Maximum ${MAX_IDS_PER_REQUEST} user IDs per request`
        });
        callback({});
        return;
      }

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

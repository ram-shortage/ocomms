import type { Server, Socket } from "socket.io";
import type { Redis } from "ioredis";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";
import { getRoomName } from "../rooms";

/** Presence TTL in seconds - user goes offline if no heartbeat */
export const PRESENCE_TTL = 60;

/** Client heartbeat interval in milliseconds */
export const HEARTBEAT_INTERVAL = 30000;

export type PresenceStatus = "active" | "away" | "offline";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Get the Redis key for a user's presence in a workspace.
 */
function getPresenceKey(workspaceId: string, userId: string): string {
  return `presence:${workspaceId}:${userId}`;
}

export interface PresenceManager {
  /**
   * Set user as online (active) in workspace.
   * Broadcasts presence:update to all workspace members.
   */
  setOnline(userId: string, workspaceId: string): Promise<void>;

  /**
   * Set user as away in workspace.
   * Broadcasts presence:update to all workspace members.
   */
  setAway(userId: string, workspaceId: string): Promise<void>;

  /**
   * Set user as offline in workspace.
   * Broadcasts presence:update to all workspace members.
   */
  setOffline(userId: string, workspaceId: string): Promise<void>;

  /**
   * Get a single user's presence status.
   * Returns "offline" if no presence data found.
   */
  getStatus(userId: string, workspaceId: string): Promise<PresenceStatus>;

  /**
   * Get presence status for multiple users in a workspace.
   * Returns a map of userId -> status.
   */
  getWorkspacePresence(
    workspaceId: string,
    userIds: string[]
  ): Promise<Record<string, PresenceStatus>>;

  /**
   * Refresh the TTL for a user's presence (heartbeat).
   * Does not change the status, only extends the expiry.
   */
  heartbeat(userId: string, workspaceId: string): Promise<void>;
}

/**
 * Setup presence management with Redis backend.
 * Returns a PresenceManager object with methods for presence operations.
 */
export function setupPresence(io: SocketIOServer, redis: Redis): PresenceManager {
  const broadcastPresence = (
    workspaceId: string,
    userId: string,
    status: PresenceStatus
  ) => {
    io.to(getRoomName.workspace(workspaceId)).emit("presence:update", {
      userId,
      status,
    });
  };

  return {
    async setOnline(userId: string, workspaceId: string): Promise<void> {
      const key = getPresenceKey(workspaceId, userId);
      await redis.setex(key, PRESENCE_TTL, "active");
      broadcastPresence(workspaceId, userId, "active");
    },

    async setAway(userId: string, workspaceId: string): Promise<void> {
      const key = getPresenceKey(workspaceId, userId);
      await redis.setex(key, PRESENCE_TTL, "away");
      broadcastPresence(workspaceId, userId, "away");
    },

    async setOffline(userId: string, workspaceId: string): Promise<void> {
      const key = getPresenceKey(workspaceId, userId);
      await redis.del(key);
      broadcastPresence(workspaceId, userId, "offline");
    },

    async getStatus(userId: string, workspaceId: string): Promise<PresenceStatus> {
      const key = getPresenceKey(workspaceId, userId);
      const status = await redis.get(key);
      if (status === "active" || status === "away") {
        return status;
      }
      return "offline";
    },

    async getWorkspacePresence(
      workspaceId: string,
      userIds: string[]
    ): Promise<Record<string, PresenceStatus>> {
      if (userIds.length === 0) {
        return {};
      }

      const pipeline = redis.pipeline();
      for (const userId of userIds) {
        pipeline.get(getPresenceKey(workspaceId, userId));
      }

      const results = await pipeline.exec();
      const presenceMap: Record<string, PresenceStatus> = {};

      if (results) {
        for (let i = 0; i < userIds.length; i++) {
          const [err, status] = results[i];
          if (!err && (status === "active" || status === "away")) {
            presenceMap[userIds[i]] = status as PresenceStatus;
          } else {
            presenceMap[userIds[i]] = "offline";
          }
        }
      }

      return presenceMap;
    },

    async heartbeat(userId: string, workspaceId: string): Promise<void> {
      const key = getPresenceKey(workspaceId, userId);
      // Only refresh TTL if key exists (user is online)
      await redis.expire(key, PRESENCE_TTL);
    },
  };
}

/**
 * Handle presence events for a connected socket.
 * Sets up heartbeat interval and presence event handlers.
 */
export function handlePresenceEvents(
  socket: TypedSocket,
  io: SocketIOServer,
  presence: PresenceManager
): void {
  const userId = socket.data.userId;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  // Helper to get workspaceId from socket data
  const getWorkspaceId = (): string | undefined => socket.data.workspaceId;

  // Set online when workspace room is joined (handled externally)
  // This function is called after connection, presence is set when workspace is known

  // Start heartbeat when workspaceId is available
  const startHeartbeat = () => {
    const workspaceId = getWorkspaceId();
    if (workspaceId && !heartbeatTimer) {
      heartbeatTimer = setInterval(async () => {
        const wsId = getWorkspaceId();
        if (wsId) {
          await presence.heartbeat(userId, wsId);
        }
      }, HEARTBEAT_INTERVAL);
    }
  };

  // Handle presence:setAway event
  socket.on("presence:setAway", async () => {
    const workspaceId = getWorkspaceId();
    if (workspaceId) {
      await presence.setAway(userId, workspaceId);
    }
  });

  // Handle presence:setActive event
  socket.on("presence:setActive", async () => {
    const workspaceId = getWorkspaceId();
    if (workspaceId) {
      await presence.setOnline(userId, workspaceId);
      startHeartbeat();
    }
  });

  // Clean up on disconnect
  socket.on("disconnect", async () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    const workspaceId = getWorkspaceId();
    if (workspaceId) {
      await presence.setOffline(userId, workspaceId);
    }
  });

  // Export startHeartbeat for use when workspace is set
  // Store it on socket for access in room join handler
  (socket as TypedSocket & { startPresenceHeartbeat?: () => void }).startPresenceHeartbeat = startHeartbeat;
}

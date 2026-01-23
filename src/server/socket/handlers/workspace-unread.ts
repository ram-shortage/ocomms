import type { Server, Socket } from "socket.io";
import type { Redis } from "ioredis";
import { db } from "@/db";
import {
  channels,
  channelMembers,
  channelReadState,
  conversations,
  conversationParticipants,
  messages,
} from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getRoomName } from "../rooms";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@/lib/socket-events";
import { isOrganizationMember } from "../authz";

type SocketIOServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type SocketWithData = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const WORKSPACE_UNREAD_CACHE_TTL = 30; // seconds

// Maximum workspace IDs per request to prevent DoS
const MAX_WORKSPACES_PER_REQUEST = 50;

/**
 * Get Redis cache key for workspace unread count.
 */
function getWorkspaceUnreadKey(
  userId: string,
  workspaceId: string
): string {
  return `workspace-unread:${userId}:${workspaceId}`;
}

export interface WorkspaceUnreadManager {
  getWorkspaceUnreadCount(
    userId: string,
    workspaceId: string
  ): Promise<number>;
  notifyWorkspaceUnreadUpdate(
    userId: string,
    workspaceId: string
  ): Promise<void>;
}

/**
 * Setup workspace unread handlers with optional Redis caching.
 * Returns a WorkspaceUnreadManager object with methods for workspace unread operations.
 */
export function setupWorkspaceUnreadHandlers(
  io: SocketIOServer,
  redis: Redis | null
): WorkspaceUnreadManager {
  return {
    /**
     * Compute workspace-level unread count by aggregating channel + conversation unreads.
     * Uses Redis cache if available, falls back to DB-only.
     */
    async getWorkspaceUnreadCount(
      userId: string,
      workspaceId: string
    ): Promise<number> {
      // Try Redis cache first
      if (redis) {
        const cacheKey = getWorkspaceUnreadKey(userId, workspaceId);
        try {
          const cached = await redis.get(cacheKey);
          if (cached !== null) {
            return parseInt(cached, 10);
          }
        } catch (err) {
          console.error("[WorkspaceUnread] Redis get error:", err);
          // Continue to DB computation
        }
      }

      // Compute from DB using efficient SQL aggregation
      // Aggregate channel unreads for this workspace
      const channelUnreadsResult = await db
        .select({
          unreads: sql<number>`COALESCE(SUM(
            COALESCE(max_seq.max_seq, 0) - COALESCE(${channelReadState.lastReadSequence}, 0)
          ), 0)`,
        })
        .from(channels)
        .innerJoin(
          channelMembers,
          and(
            eq(channelMembers.channelId, channels.id),
            eq(channelMembers.userId, userId)
          )
        )
        .leftJoin(
          channelReadState,
          and(
            eq(channelReadState.channelId, channels.id),
            eq(channelReadState.userId, userId)
          )
        )
        .leftJoin(
          sql`LATERAL (
            SELECT COALESCE(MAX(${messages.sequence}), 0) as max_seq
            FROM ${messages}
            WHERE ${messages.channelId} = ${channels.id}
              AND ${messages.deletedAt} IS NULL
          ) max_seq`,
          sql`true`
        )
        .where(eq(channels.organizationId, workspaceId));

      // Aggregate conversation unreads for this workspace
      const conversationUnreadsResult = await db
        .select({
          unreads: sql<number>`COALESCE(SUM(
            COALESCE(max_seq.max_seq, 0) - COALESCE(${channelReadState.lastReadSequence}, 0)
          ), 0)`,
        })
        .from(conversations)
        .innerJoin(
          conversationParticipants,
          and(
            eq(conversationParticipants.conversationId, conversations.id),
            eq(conversationParticipants.userId, userId)
          )
        )
        .leftJoin(
          channelReadState,
          and(
            eq(channelReadState.conversationId, conversations.id),
            eq(channelReadState.userId, userId)
          )
        )
        .leftJoin(
          sql`LATERAL (
            SELECT COALESCE(MAX(${messages.sequence}), 0) as max_seq
            FROM ${messages}
            WHERE ${messages.conversationId} = ${conversations.id}
              AND ${messages.deletedAt} IS NULL
          ) max_seq`,
          sql`true`
        )
        .where(eq(conversations.organizationId, workspaceId));

      const totalUnreads =
        (channelUnreadsResult[0]?.unreads ?? 0) +
        (conversationUnreadsResult[0]?.unreads ?? 0);

      // Cache result if Redis available
      if (redis) {
        try {
          await redis.setex(
            getWorkspaceUnreadKey(userId, workspaceId),
            WORKSPACE_UNREAD_CACHE_TTL,
            totalUnreads.toString()
          );
        } catch (err) {
          console.error("[WorkspaceUnread] Redis setex error:", err);
        }
      }

      return totalUnreads;
    },

    /**
     * Notify user of workspace unread count update.
     * Invalidates cache and emits update event.
     */
    async notifyWorkspaceUnreadUpdate(
      userId: string,
      workspaceId: string
    ): Promise<void> {
      // Invalidate cache
      if (redis) {
        try {
          await redis.del(getWorkspaceUnreadKey(userId, workspaceId));
        } catch (err) {
          console.error("[WorkspaceUnread] Redis del error:", err);
        }
      }

      // Get fresh count
      const count = await this.getWorkspaceUnreadCount(userId, workspaceId);

      // Emit update to user's devices
      io.to(getRoomName.user(userId)).emit("workspace:unreadUpdate", {
        workspaceId,
        unreadCount: count,
      });
    },
  };
}

/**
 * Register socket event handlers for workspace unread management.
 */
export function handleWorkspaceUnreadEvents(
  socket: SocketWithData,
  io: SocketIOServer,
  workspaceUnreadManager: WorkspaceUnreadManager
): void {
  const userId = socket.data.userId;

  // Fetch workspace unread counts
  socket.on("workspace:fetchUnreads", async (data, callback) => {
    // Cap workspace IDs to prevent DoS
    if (data.workspaceIds.length > MAX_WORKSPACES_PER_REQUEST) {
      socket.emit("error", {
        message: `Maximum ${MAX_WORKSPACES_PER_REQUEST} workspaces per request`,
      });
      callback({ counts: {} });
      return;
    }

    try {
      const counts: Record<string, number> = {};

      for (const workspaceId of data.workspaceIds) {
        // Only return count if user is member of workspace
        const isMember = await isOrganizationMember(userId, workspaceId);
        if (isMember) {
          counts[workspaceId] =
            await workspaceUnreadManager.getWorkspaceUnreadCount(
              userId,
              workspaceId
            );
        }
        // Silently skip unauthorized workspaces (don't reveal existence)
      }

      callback({ counts });
    } catch (error) {
      console.error("[WorkspaceUnread] Error fetching counts:", error);
      callback({ counts: {} });
    }
  });
}

import type { Server, Socket } from "socket.io";
import type { Redis } from "ioredis";
import { db } from "@/db";
import { channelReadState, messages, channelMembers, conversationParticipants } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getRoomName } from "../rooms";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";
import { isChannelMember, isConversationParticipant, getMessageContext } from "../authz";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const UNREAD_CACHE_TTL = 60; // seconds

/**
 * Get Redis cache key for channel unread count.
 */
function getChannelUnreadKey(userId: string, channelId: string): string {
  return `unread:${userId}:channel:${channelId}`;
}

/**
 * Get Redis cache key for conversation unread count.
 */
function getConversationUnreadKey(userId: string, conversationId: string): string {
  return `unread:${userId}:conv:${conversationId}`;
}

export interface UnreadManager {
  getUnreadCount(userId: string, channelId: string): Promise<number>;
  getConversationUnreadCount(userId: string, conversationId: string): Promise<number>;
  markChannelAsRead(userId: string, channelId: string): Promise<void>;
  markConversationAsRead(userId: string, conversationId: string): Promise<void>;
  markMessageAsUnread(userId: string, messageId: string): Promise<void>;
  notifyUnreadIncrement(channelId: string, senderId: string, newSequence: number): Promise<void>;
  notifyConversationUnreadIncrement(conversationId: string, senderId: string, newSequence: number): Promise<void>;
}

/**
 * Setup unread handlers with optional Redis caching.
 * Returns an UnreadManager object with methods for unread operations.
 */
export function setupUnreadHandlers(io: SocketIOServer, redis: Redis | null): UnreadManager {
  return {
    /**
     * Compute unread count for a channel.
     * Uses Redis cache if available, falls back to DB-only.
     */
    async getUnreadCount(userId: string, channelId: string): Promise<number> {
      // Try Redis cache first
      if (redis) {
        const cacheKey = getChannelUnreadKey(userId, channelId);
        try {
          const cached = await redis.get(cacheKey);
          if (cached !== null) {
            return parseInt(cached, 10);
          }
        } catch (err) {
          console.error("[Unread] Redis get error:", err);
          // Continue to DB computation
        }
      }

      // Compute from DB
      const [maxSeqResult] = await db
        .select({ maxSeq: sql<number>`COALESCE(MAX(${messages.sequence}), 0)` })
        .from(messages)
        .where(and(
          eq(messages.channelId, channelId),
          isNull(messages.deletedAt)
        ));

      const readState = await db.query.channelReadState.findFirst({
        where: and(
          eq(channelReadState.userId, userId),
          eq(channelReadState.channelId, channelId)
        ),
      });

      // Calculate effective read position
      let effectiveReadSeq = readState?.lastReadSequence ?? 0;
      if (readState?.markedUnreadAtSequence !== null && readState?.markedUnreadAtSequence !== undefined) {
        effectiveReadSeq = Math.min(effectiveReadSeq, readState.markedUnreadAtSequence - 1);
      }

      const unread = Math.max(0, (maxSeqResult?.maxSeq ?? 0) - effectiveReadSeq);

      // Cache result if Redis available
      if (redis) {
        try {
          await redis.setex(getChannelUnreadKey(userId, channelId), UNREAD_CACHE_TTL, unread.toString());
        } catch (err) {
          console.error("[Unread] Redis setex error:", err);
        }
      }

      return unread;
    },

    /**
     * Compute unread count for a conversation (DM).
     */
    async getConversationUnreadCount(userId: string, conversationId: string): Promise<number> {
      // Try Redis cache first
      if (redis) {
        const cacheKey = getConversationUnreadKey(userId, conversationId);
        try {
          const cached = await redis.get(cacheKey);
          if (cached !== null) {
            return parseInt(cached, 10);
          }
        } catch (err) {
          console.error("[Unread] Redis get error:", err);
        }
      }

      // Compute from DB
      const [maxSeqResult] = await db
        .select({ maxSeq: sql<number>`COALESCE(MAX(${messages.sequence}), 0)` })
        .from(messages)
        .where(and(
          eq(messages.conversationId, conversationId),
          isNull(messages.deletedAt)
        ));

      const readState = await db.query.channelReadState.findFirst({
        where: and(
          eq(channelReadState.userId, userId),
          eq(channelReadState.conversationId, conversationId)
        ),
      });

      let effectiveReadSeq = readState?.lastReadSequence ?? 0;
      if (readState?.markedUnreadAtSequence !== null && readState?.markedUnreadAtSequence !== undefined) {
        effectiveReadSeq = Math.min(effectiveReadSeq, readState.markedUnreadAtSequence - 1);
      }

      const unread = Math.max(0, (maxSeqResult?.maxSeq ?? 0) - effectiveReadSeq);

      if (redis) {
        try {
          await redis.setex(getConversationUnreadKey(userId, conversationId), UNREAD_CACHE_TTL, unread.toString());
        } catch (err) {
          console.error("[Unread] Redis setex error:", err);
        }
      }

      return unread;
    },

    /**
     * Mark channel as read (all messages up to current max).
     */
    async markChannelAsRead(userId: string, channelId: string): Promise<void> {
      const [maxSeqResult] = await db
        .select({ maxSeq: sql<number>`COALESCE(MAX(${messages.sequence}), 0)` })
        .from(messages)
        .where(and(
          eq(messages.channelId, channelId),
          isNull(messages.deletedAt)
        ));

      await db
        .insert(channelReadState)
        .values({
          userId,
          channelId,
          lastReadSequence: maxSeqResult?.maxSeq ?? 0,
          markedUnreadAtSequence: null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [channelReadState.userId, channelReadState.channelId],
          set: {
            lastReadSequence: maxSeqResult?.maxSeq ?? 0,
            markedUnreadAtSequence: null,
            updatedAt: new Date(),
          },
        });

      // Invalidate cache
      if (redis) {
        try {
          await redis.del(getChannelUnreadKey(userId, channelId));
        } catch (err) {
          console.error("[Unread] Redis del error:", err);
        }
      }

      // Emit update to user's devices
      io.to(getRoomName.user(userId)).emit("unread:update", {
        channelId,
        unreadCount: 0,
      });
    },

    /**
     * Mark conversation as read (all messages up to current max).
     */
    async markConversationAsRead(userId: string, conversationId: string): Promise<void> {
      const [maxSeqResult] = await db
        .select({ maxSeq: sql<number>`COALESCE(MAX(${messages.sequence}), 0)` })
        .from(messages)
        .where(and(
          eq(messages.conversationId, conversationId),
          isNull(messages.deletedAt)
        ));

      await db
        .insert(channelReadState)
        .values({
          userId,
          conversationId,
          lastReadSequence: maxSeqResult?.maxSeq ?? 0,
          markedUnreadAtSequence: null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [channelReadState.userId, channelReadState.conversationId],
          set: {
            lastReadSequence: maxSeqResult?.maxSeq ?? 0,
            markedUnreadAtSequence: null,
            updatedAt: new Date(),
          },
        });

      if (redis) {
        try {
          await redis.del(getConversationUnreadKey(userId, conversationId));
        } catch (err) {
          console.error("[Unread] Redis del error:", err);
        }
      }

      io.to(getRoomName.user(userId)).emit("unread:update", {
        conversationId,
        unreadCount: 0,
      });
    },

    /**
     * Mark a specific message as unread (and all after it).
     */
    async markMessageAsUnread(userId: string, messageId: string): Promise<void> {
      const message = await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
        columns: { sequence: true, channelId: true, conversationId: true },
      });

      if (!message) {
        throw new Error("Message not found");
      }

      const { channelId, conversationId, sequence } = message;

      if (channelId) {
        // Upsert for channel
        await db
          .insert(channelReadState)
          .values({
            userId,
            channelId,
            lastReadSequence: 0,
            markedUnreadAtSequence: sequence,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [channelReadState.userId, channelReadState.channelId],
            set: {
              markedUnreadAtSequence: sequence,
              updatedAt: new Date(),
            },
          });

        if (redis) {
          try {
            await redis.del(getChannelUnreadKey(userId, channelId));
          } catch (err) {
            console.error("[Unread] Redis del error:", err);
          }
        }

        // Get new count and emit
        const newCount = await this.getUnreadCount(userId, channelId);
        io.to(getRoomName.user(userId)).emit("unread:update", {
          channelId,
          unreadCount: newCount,
        });
      } else if (conversationId) {
        // Upsert for conversation
        await db
          .insert(channelReadState)
          .values({
            userId,
            conversationId,
            lastReadSequence: 0,
            markedUnreadAtSequence: sequence,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [channelReadState.userId, channelReadState.conversationId],
            set: {
              markedUnreadAtSequence: sequence,
              updatedAt: new Date(),
            },
          });

        if (redis) {
          try {
            await redis.del(getConversationUnreadKey(userId, conversationId));
          } catch (err) {
            console.error("[Unread] Redis del error:", err);
          }
        }

        const newCount = await this.getConversationUnreadCount(userId, conversationId);
        io.to(getRoomName.user(userId)).emit("unread:update", {
          conversationId,
          unreadCount: newCount,
        });
      }
    },

    /**
     * Notify channel members of new unread (called after message:new).
     * Invalidates cache for all members except sender, emits updates.
     */
    async notifyUnreadIncrement(channelId: string, senderId: string, _newSequence: number): Promise<void> {
      // Get all channel members except sender
      const members = await db
        .select({ userId: channelMembers.userId })
        .from(channelMembers)
        .where(eq(channelMembers.channelId, channelId));

      for (const member of members) {
        if (member.userId === senderId) continue;

        // Invalidate cache
        if (redis) {
          try {
            await redis.del(getChannelUnreadKey(member.userId, channelId));
          } catch (err) {
            console.error("[Unread] Redis del error:", err);
          }
        }

        // Get new count and emit
        const count = await this.getUnreadCount(member.userId, channelId);
        io.to(getRoomName.user(member.userId)).emit("unread:update", {
          channelId,
          unreadCount: count,
        });
      }
    },

    /**
     * Notify conversation participants of new unread (called after message:new).
     */
    async notifyConversationUnreadIncrement(conversationId: string, senderId: string, _newSequence: number): Promise<void> {
      // Get all conversation participants except sender
      const participants = await db
        .select({ userId: conversationParticipants.userId })
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conversationId));

      for (const participant of participants) {
        if (participant.userId === senderId) continue;

        if (redis) {
          try {
            await redis.del(getConversationUnreadKey(participant.userId, conversationId));
          } catch (err) {
            console.error("[Unread] Redis del error:", err);
          }
        }

        const count = await this.getConversationUnreadCount(participant.userId, conversationId);
        io.to(getRoomName.user(participant.userId)).emit("unread:update", {
          conversationId,
          unreadCount: count,
        });
      }
    },
  };
}

/**
 * Register socket event handlers for unread management.
 */
export function handleUnreadEvents(
  socket: SocketWithData,
  io: SocketIOServer,
  unreadManager: UnreadManager
): void {
  const userId = socket.data.userId;

  // Fetch unread counts for multiple channels/conversations
  socket.on("unread:fetch", async (data, callback) => {
    try {
      const channels: Record<string, number> = {};
      const conversations: Record<string, number> = {};

      if (data.channelIds) {
        for (const channelId of data.channelIds) {
          // Only return count if user is member
          const isMember = await isChannelMember(userId, channelId);
          if (isMember) {
            channels[channelId] = await unreadManager.getUnreadCount(userId, channelId);
          }
          // Silently skip unauthorized channels (don't reveal existence)
        }
      }

      if (data.conversationIds) {
        for (const conversationId of data.conversationIds) {
          // Only return count if user is participant
          const isParticipant = await isConversationParticipant(userId, conversationId);
          if (isParticipant) {
            conversations[conversationId] = await unreadManager.getConversationUnreadCount(userId, conversationId);
          }
          // Silently skip unauthorized conversations
        }
      }

      callback({ channels, conversations });
    } catch (error) {
      console.error("[Unread] Error fetching counts:", error);
      callback({ channels: {}, conversations: {} });
    }
  });

  // Mark channel or conversation as read
  socket.on("unread:markRead", async (data, callback) => {
    try {
      if (data.channelId) {
        await unreadManager.markChannelAsRead(userId, data.channelId);
      } else if (data.conversationId) {
        await unreadManager.markConversationAsRead(userId, data.conversationId);
      }
      callback({ success: true });
    } catch (error) {
      console.error("[Unread] Error marking as read:", error);
      callback({ success: false });
    }
  });

  // Mark message as unread
  socket.on("unread:markMessageUnread", async (data, callback) => {
    try {
      await unreadManager.markMessageAsUnread(userId, data.messageId);
      callback({ success: true });
    } catch (error) {
      console.error("[Unread] Error marking as unread:", error);
      callback({ success: false });
    }
  });
}

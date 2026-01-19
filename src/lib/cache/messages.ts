/**
 * Message cache operations for IndexedDB.
 * Provides CRUD operations with graceful error handling.
 */
import Dexie from "dexie";
import { db, type CachedMessage } from "./db";
import type { Message } from "@/lib/socket-events";

/** Number of days to retain cached messages before cleanup */
const RETENTION_DAYS = 7;

/**
 * Convert a Message from socket-events to CachedMessage format.
 * Flattens the author object and sets cachedAt timestamp.
 */
function messageToCache(message: Message): CachedMessage {
  return {
    id: message.id,
    content: message.content,
    authorId: message.authorId,
    authorName: message.author?.name ?? null,
    authorEmail: message.author?.email ?? "",
    channelId: message.channelId ?? null,
    conversationId: message.conversationId ?? null,
    parentId: message.parentId ?? null,
    replyCount: message.replyCount ?? 0,
    sequence: message.sequence,
    deletedAt: message.deletedAt ?? null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    cachedAt: new Date(),
  };
}

/**
 * Cache a single message.
 * Uses put() which inserts or updates based on primary key.
 * Logs errors but doesn't throw - graceful degradation.
 */
export async function cacheMessage(message: Message): Promise<void> {
  try {
    await db.messages.put(messageToCache(message));
  } catch (err) {
    console.error("[Cache] Failed to cache message:", err);
  }
}

/**
 * Cache multiple messages in a batch operation.
 * Uses bulkPut() for 5-10x faster performance than individual puts.
 * Logs errors but doesn't throw - graceful degradation.
 */
export async function cacheMessages(messages: Message[]): Promise<void> {
  try {
    const cached = messages.map(messageToCache);
    await db.messages.bulkPut(cached);
  } catch (err) {
    console.error("[Cache] Failed to bulk cache messages:", err);
  }
}

/**
 * Update a cached message's deletion status.
 * Also refreshes cachedAt to extend TTL.
 */
export async function updateMessageDeletion(
  messageId: string,
  deletedAt: Date
): Promise<void> {
  try {
    await db.messages.update(messageId, { deletedAt, cachedAt: new Date() });
  } catch (err) {
    console.error("[Cache] Failed to update message deletion:", err);
  }
}

/**
 * Get cached messages for a channel, ordered by sequence.
 * Uses compound index for efficient querying.
 */
export async function getCachedChannelMessages(
  channelId: string
): Promise<CachedMessage[]> {
  return db.messages
    .where("[channelId+sequence]")
    .between([channelId, Dexie.minKey], [channelId, Dexie.maxKey])
    .toArray();
}

/**
 * Get cached messages for a conversation (DM), ordered by sequence.
 * Uses compound index for efficient querying.
 */
export async function getCachedConversationMessages(
  conversationId: string
): Promise<CachedMessage[]> {
  return db.messages
    .where("[conversationId+sequence]")
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .toArray();
}

/**
 * Delete messages older than RETENTION_DAYS from cache.
 * Returns the number of deleted messages.
 */
export async function cleanupExpiredMessages(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const count = await db.messages.where("cachedAt").below(cutoff).delete();

  if (count > 0) {
    console.log(`[Cache] Cleaned up ${count} expired messages`);
  }

  return count;
}

/**
 * Clear all cached messages.
 * For debugging/testing purposes.
 */
export async function clearAllCache(): Promise<void> {
  await db.messages.clear();
  console.log("[Cache] Cleared all cached messages");
}

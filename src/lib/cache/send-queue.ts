/**
 * Send queue operations for IndexedDB.
 * Provides CRUD operations for offline message queuing with graceful error handling.
 */
import { db, type QueuedMessage, type SendStatus } from "./db";

/**
 * Add a message to the send queue.
 * Sets initial retry state and logs errors but doesn't throw (graceful degradation).
 */
export async function queueMessage(
  message: Omit<QueuedMessage, "retryCount" | "lastError" | "lastAttemptAt">
): Promise<void> {
  try {
    await db.sendQueue.add({
      ...message,
      retryCount: 0,
      lastError: null,
      lastAttemptAt: null,
    });
  } catch (err) {
    console.error("[Cache] Failed to queue message:", err);
  }
}

/**
 * Update a queued message's status and optional fields.
 * Also updates lastAttemptAt timestamp.
 * Logs errors but doesn't throw (graceful degradation).
 */
export async function updateQueueStatus(
  clientId: string,
  status: SendStatus,
  updates?: Partial<QueuedMessage>
): Promise<void> {
  try {
    await db.sendQueue.update(clientId, {
      status,
      lastAttemptAt: new Date(),
      ...updates,
    });
  } catch (err) {
    console.error("[Cache] Failed to update queue status:", err);
  }
}

/**
 * Get pending messages that need to be sent.
 * Returns messages with status "pending" or "failed", sorted by createdAt (FIFO).
 * Optionally filters by targetId.
 */
export async function getPendingMessages(
  targetId?: string
): Promise<QueuedMessage[]> {
  try {
    let query = db.sendQueue
      .where("status")
      .anyOf(["pending", "failed"]);

    if (targetId) {
      // Filter by targetId after getting pending/failed messages
      return (await query.toArray())
        .filter((msg) => msg.targetId === targetId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    // Sort by createdAt for FIFO processing
    return query.sortBy("createdAt");
  } catch (err) {
    console.error("[Cache] Failed to get pending messages:", err);
    return [];
  }
}

/**
 * Remove a message from the queue after successful send.
 * Logs errors but doesn't throw (graceful degradation).
 */
export async function removeFromQueue(clientId: string): Promise<void> {
  try {
    await db.sendQueue.delete(clientId);
  } catch (err) {
    console.error("[Cache] Failed to remove from queue:", err);
  }
}

/**
 * Get all non-sent queued messages for a specific target.
 * Used by useSendQueue hook for UI display.
 * Returns messages ordered by createdAt.
 */
export async function getQueuedMessagesByTarget(
  targetId: string
): Promise<QueuedMessage[]> {
  try {
    const messages = await db.sendQueue
      .where("targetId")
      .equals(targetId)
      .toArray();

    // Filter out sent messages and sort by createdAt
    return messages
      .filter((msg) => msg.status !== "sent")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } catch (err) {
    console.error("[Cache] Failed to get queued messages by target:", err);
    return [];
  }
}

"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type QueuedMessage } from "./db";

/**
 * Reactive hook for pending messages in the send queue.
 *
 * Uses Dexie's useLiveQuery for automatic re-rendering when IndexedDB changes,
 * including changes from other tabs.
 *
 * @param targetId - Channel ID or conversation ID to filter by (null returns empty array)
 * @returns Array of queued messages that haven't been sent yet, ordered by createdAt
 */
export function useSendQueue(targetId: string | null): QueuedMessage[] {
  // Return empty array for SSR safety or when no targetId provided
  if (targetId === null) {
    return [];
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pendingMessages = useLiveQuery(
    async () => {
      return db.sendQueue
        .where("targetId")
        .equals(targetId)
        .filter((msg) => msg.status !== "sent")
        .sortBy("createdAt");
    },
    [targetId],
    [] // Default value while loading
  );

  return pendingMessages ?? [];
}

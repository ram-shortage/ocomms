/**
 * React hooks for accessing cached messages with automatic reactivity.
 * Uses useLiveQuery from dexie-react-hooks for automatic re-renders
 * when IndexedDB data changes (including from other tabs).
 */
"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Dexie from "dexie";
import { db, type CachedMessage } from "./db";

/**
 * Get cached messages for a channel with reactive updates.
 * Returns messages ordered by sequence number.
 * @param channelId - Channel ID to fetch messages for, or null to skip
 * @returns Array of cached messages, empty while loading or if channelId is null
 */
export function useCachedChannelMessages(
  channelId: string | null
): CachedMessage[] {
  const messages = useLiveQuery(
    () => {
      if (!channelId) return [];
      return db.messages
        .where("[channelId+sequence]")
        .between([channelId, Dexie.minKey], [channelId, Dexie.maxKey])
        .toArray();
    },
    [channelId],
    [] // default value while loading
  );

  return messages;
}

/**
 * Get cached messages for a DM conversation with reactive updates.
 * Returns messages ordered by sequence number.
 * @param conversationId - Conversation ID to fetch messages for, or null to skip
 * @returns Array of cached messages, empty while loading or if conversationId is null
 */
export function useCachedConversationMessages(
  conversationId: string | null
): CachedMessage[] {
  const messages = useLiveQuery(
    () => {
      if (!conversationId) return [];
      return db.messages
        .where("[conversationId+sequence]")
        .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
        .toArray();
    },
    [conversationId],
    [] // default value while loading
  );

  return messages;
}

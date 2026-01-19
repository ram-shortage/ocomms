"use client";

import { useCallback } from "react";
import { useSocket } from "@/lib/socket-client";
import { useOnlineStatus } from "@/lib/pwa/use-online-status";
import { queueMessage, type QueuedMessage } from "@/lib/cache";

/**
 * Options for useSendMessage hook.
 */
export interface UseSendMessageOptions {
  targetId: string;
  targetType: "channel" | "dm";
  parentId?: string | null;
}

/**
 * Return type for useSendMessage hook.
 */
export interface UseSendMessageReturn {
  sendMessage: (content: string) => Promise<{ clientId: string }>;
  isOnline: boolean;
}

/**
 * Stub: Process the send queue immediately (implemented in 17-02).
 * This is a no-op stub that will be replaced when queue-processor.ts exists.
 */
async function processQueueStub(): Promise<void> {
  console.log("[SendMessage] Queue processing will be available after 17-02");
}

/**
 * Stub: Register for background sync (implemented in 17-02).
 * This is a no-op stub that will be replaced when queue-processor.ts exists.
 */
async function registerBackgroundSyncStub(): Promise<void> {
  console.log("[SendMessage] Background sync will be available after 17-02");
}

/**
 * Hook for sending messages with optimistic UI support.
 *
 * Always queues messages to IndexedDB first for offline resilience.
 * When online, triggers immediate queue processing.
 * When offline, registers for background sync.
 *
 * @param options - Target configuration (channel/dm, targetId, optional parentId)
 * @returns sendMessage function and online status
 */
export function useSendMessage({
  targetId,
  targetType,
  parentId = null,
}: UseSendMessageOptions): UseSendMessageReturn {
  const socket = useSocket();
  const { isOnline } = useOnlineStatus();

  const sendMessage = useCallback(
    async (content: string): Promise<{ clientId: string }> => {
      // Generate unique client ID
      const clientId = crypto.randomUUID();

      // Create message object for queue
      const message: Omit<QueuedMessage, "retryCount" | "lastError" | "lastAttemptAt"> = {
        clientId,
        serverId: null,
        content: content.trim(),
        targetId,
        targetType,
        parentId: parentId ?? null,
        status: "pending",
        createdAt: new Date(),
      };

      // Always queue to IndexedDB first (offline-first approach)
      await queueMessage(message);
      console.log("[SendMessage] Queued message:", clientId);

      if (isOnline) {
        // Process queue immediately when online
        // TODO: Replace stub with actual processQueue from @/lib/cache when 17-02 is complete
        processQueueStub().catch(console.error);
      } else {
        // Register for background sync when offline
        // TODO: Replace stub with actual registerBackgroundSync from @/lib/cache when 17-02 is complete
        registerBackgroundSyncStub().catch(console.error);
      }

      return { clientId };
    },
    [targetId, targetType, parentId, isOnline]
  );

  return { sendMessage, isOnline };
}

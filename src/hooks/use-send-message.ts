"use client";

import { useCallback } from "react";
import { useSocket } from "@/lib/socket-client";
import { useOnlineStatus } from "@/lib/pwa/use-online-status";
import {
  queueMessage,
  processQueue,
  registerBackgroundSync,
  type QueuedMessage,
} from "@/lib/cache";

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
        processQueue(socket).catch(console.error);
      } else {
        // Register for background sync when offline
        registerBackgroundSync().catch(console.error);
      }

      return { clientId };
    },
    [targetId, targetType, parentId, isOnline]
  );

  return { sendMessage, isOnline };
}

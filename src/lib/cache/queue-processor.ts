/**
 * Queue processor for sending pending messages via Socket.io.
 * Processes offline-queued messages when network is available with exponential backoff.
 */
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../socket-events";
import {
  getPendingMessages,
  updateQueueStatus,
  removeFromQueue,
} from "./send-queue";
import { calculateBackoff, shouldRetry, sleep } from "../retry/backoff";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Prevents concurrent queue processing */
let isProcessing = false;

/** Send timeout in milliseconds */
const SEND_TIMEOUT_MS = 10000;

/**
 * Process all pending messages in the queue.
 * Sends messages via Socket.io with exponential backoff for failures.
 * Handles rate limit errors by using server's retryAfter duration.
 */
export async function processQueue(socket: TypedSocket): Promise<void> {
  // Guard: don't process if already processing or offline
  if (isProcessing || !navigator.onLine) {
    console.log("[QueueProcessor] Skipping - isProcessing:", isProcessing, "online:", navigator.onLine);
    return;
  }

  isProcessing = true;
  console.log("[QueueProcessor] Starting queue processing");

  try {
    const pendingMessages = await getPendingMessages();
    console.log("[QueueProcessor] Found", pendingMessages.length, "pending messages");

    for (const msg of pendingMessages) {
      // Skip if exceeded max retries
      if (msg.status === "failed" && !shouldRetry(msg.retryCount)) {
        console.log("[QueueProcessor] Skipping message", msg.clientId, "- exceeded max retries");
        continue;
      }

      // Apply backoff delay if this is a retry
      if (msg.retryCount > 0) {
        const delay = calculateBackoff(msg.retryCount);
        console.log("[QueueProcessor] Retry", msg.retryCount, "- waiting", Math.round(delay), "ms");
        await sleep(delay);
      }

      // Update status to sending
      await updateQueueStatus(msg.clientId, "sending");

      try {
        // Send via socket with appropriate event
        const response = await sendMessage(socket, msg);

        if (response.success && response.messageId) {
          // Success - update status and remove from queue
          console.log("[QueueProcessor] Sent message", msg.clientId, "-> server ID:", response.messageId);
          await updateQueueStatus(msg.clientId, "sent", { serverId: response.messageId });
          await removeFromQueue(msg.clientId);
        } else {
          // Failed without error (unexpected)
          console.log("[QueueProcessor] Send failed for", msg.clientId, "- no messageId");
          await updateQueueStatus(msg.clientId, "failed", {
            retryCount: msg.retryCount + 1,
            lastError: "Send failed without error message",
          });
        }
      } catch (err) {
        // Handle send errors
        const error = err as Error & { code?: string; retryAfter?: number };
        console.log("[QueueProcessor] Error sending", msg.clientId, ":", error.message);

        // Handle rate limit errors specially
        if (error.code === "RATE_LIMITED" && error.retryAfter) {
          console.log("[QueueProcessor] Rate limited - waiting", error.retryAfter, "ms before retry");
          await sleep(error.retryAfter);
        }

        await updateQueueStatus(msg.clientId, "failed", {
          retryCount: msg.retryCount + 1,
          lastError: error.message || "Unknown error",
        });
      }
    }

    console.log("[QueueProcessor] Queue processing complete");
  } finally {
    isProcessing = false;
  }
}

/**
 * Send a message via socket with timeout.
 * Routes to message:send or thread:reply based on parentId.
 * FILE-08/FILE-09: Includes attachmentIds when sending messages with attachments.
 */
async function sendMessage(
  socket: TypedSocket,
  msg: {
    targetId: string;
    targetType: "channel" | "dm";
    content: string;
    parentId: string | null;
    attachmentIds: string[] | null;
  }
): Promise<{ success: boolean; messageId?: string }> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Send timeout"));
    }, SEND_TIMEOUT_MS);

    const callback = (response: { success: boolean; messageId?: string }) => {
      clearTimeout(timeoutId);
      resolve(response);
    };

    if (msg.parentId) {
      // Thread reply (attachments not yet supported in threads)
      socket.emit("thread:reply", { parentId: msg.parentId, content: msg.content }, callback);
    } else {
      // Channel or DM message with optional attachments
      socket.emit("message:send", {
        targetId: msg.targetId,
        targetType: msg.targetType,
        content: msg.content,
        attachmentIds: msg.attachmentIds ?? undefined,
      }, callback);
    }
  });
}

/**
 * Register for Background Sync API (Chrome only).
 * Allows the service worker to sync queued messages when online.
 * Falls back silently if not available - other sync methods still work.
 */
export async function registerBackgroundSync(): Promise<void> {
  try {
    // Check for Background Sync API support
    if (!("serviceWorker" in navigator) || !("SyncManager" in window)) {
      console.log("[QueueProcessor] Background Sync not available");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    // TypeScript doesn't have full SyncManager types
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } })
      .sync.register("send-messages");
    console.log("[QueueProcessor] Background Sync registered");
  } catch (err) {
    // Not critical - fallback sync methods still work
    console.log("[QueueProcessor] Background Sync registration failed:", err);
  }
}

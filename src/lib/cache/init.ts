/**
 * Cache initialization module.
 * Handles startup cleanup and ensures single initialization.
 */
import { cleanupExpiredMessages } from "./messages";

let initialized = false;

/**
 * Initialize the message cache.
 * Runs cleanup on expired messages.
 * Safe to call multiple times - only initializes once.
 * Gracefully handles errors (IndexedDB may fail in private browsing).
 */
export async function initializeCache(): Promise<void> {
  if (initialized) return;
  if (typeof window === "undefined") return;

  try {
    await cleanupExpiredMessages();
    initialized = true;
    console.log("[Cache] Initialized");
  } catch (err) {
    console.error("[Cache] Failed to initialize:", err);
    // Continue without cache - graceful degradation
  }
}

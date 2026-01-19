/**
 * Event listeners for triggering queue processing on reconnect.
 * Supports Chrome's online event, Safari's visibility change, and Socket.io connect.
 */
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../socket-events";
import { processQueue } from "./queue-processor";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Socket instance for processing queue */
let socket: TypedSocket | null = null;

/**
 * Handle browser coming online.
 * Triggers queue processing if socket is connected.
 */
function handleOnline(): void {
  console.log("[Sync] Online event - processing queue");
  if (socket?.connected) {
    processQueue(socket).catch(console.error);
  }
}

/**
 * Handle tab becoming visible.
 * Safari fallback - triggers queue processing when user returns to tab.
 */
function handleVisibilityChange(): void {
  if (document.visibilityState === "visible" && navigator.onLine && socket?.connected) {
    console.log("[Sync] Tab visible - processing queue");
    processQueue(socket).catch(console.error);
  }
}

/**
 * Handle Socket.io connect event.
 * Adds random jitter to avoid thundering herd when many clients reconnect.
 */
function handleSocketConnect(): void {
  console.log("[Sync] Socket connected - processing queue");
  // Random jitter 0-500ms to avoid thundering herd
  const jitter = Math.random() * 500;
  setTimeout(() => {
    if (socket) {
      processQueue(socket).catch(console.error);
    }
  }, jitter);
}

/**
 * Initialize sync event listeners.
 * Call once when socket is ready to enable automatic queue processing on reconnect.
 */
export function initSyncOnReconnect(socketInstance: TypedSocket): void {
  socket = socketInstance;

  // Browser online event
  window.addEventListener("online", handleOnline);

  // Tab visibility change (Safari fallback)
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Socket.io connect event
  socketInstance.on("connect", handleSocketConnect);

  console.log("[Sync] Initialized sync-on-reconnect listeners");
}

/**
 * Clean up sync event listeners.
 * Call when component unmounts or socket is being disposed.
 */
export function cleanupSyncListeners(): void {
  window.removeEventListener("online", handleOnline);
  document.removeEventListener("visibilitychange", handleVisibilityChange);

  if (socket) {
    socket.off("connect", handleSocketConnect);
  }

  socket = null;
  console.log("[Sync] Cleaned up sync-on-reconnect listeners");
}

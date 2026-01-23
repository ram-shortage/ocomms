/**
 * Guest socket handler for soft-locked guest disconnection (SEC2-16).
 * Provides utilities to disconnect soft-locked guests from all Socket.IO connections.
 */
import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Module-level IO reference for use in workers/API routes.
 * Set during setupSocketHandlers initialization.
 */
let ioInstance: SocketIOServer | null = null;

/**
 * Store the Socket.IO server instance for later access.
 * Called during setupSocketHandlers initialization.
 */
export function setIOInstance(io: SocketIOServer): void {
  ioInstance = io;
}

/**
 * Get the Socket.IO server instance.
 * Returns null if called before setupSocketHandlers runs.
 */
export function getIOInstance(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Disconnect a soft-locked guest from all Socket.IO connections.
 * Sends a notification to the guest before disconnecting.
 *
 * @param io - Socket.IO server instance
 * @param userId - The guest user ID to disconnect
 * @param reason - Reason for disconnection (shown to user)
 */
export async function disconnectSoftLockedGuest(
  io: SocketIOServer,
  userId: string,
  reason: string = "Your guest access has been revoked"
): Promise<void> {
  // Find all sockets for this user
  const sockets = await io.fetchSockets();
  const userSockets = sockets.filter((socket) => socket.data.userId === userId);

  if (userSockets.length === 0) {
    console.log(`[Socket.IO] Guest ${userId} has no active connections`);
    return;
  }

  console.log(`[Socket.IO] Disconnecting soft-locked guest ${userId} (${userSockets.length} connections)`);

  // Send notification to each socket before disconnecting
  for (const socket of userSockets) {
    // Emit notification so client can show message
    socket.emit("guest:locked", {
      reason,
      message: "You have been disconnected. Please contact a workspace admin.",
    });

    // Small delay to ensure message is sent before disconnect
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Disconnect the socket
    socket.disconnect(true);
  }

  console.log(`[Socket.IO] Guest ${userId} disconnected successfully`);
}

/**
 * Disconnect a soft-locked guest using the stored IO instance.
 * Convenience wrapper for use in workers and API routes.
 *
 * @param userId - The guest user ID to disconnect
 * @param reason - Optional reason for disconnection
 * @returns true if disconnect was initiated, false if no IO instance available
 */
export async function disconnectGuestById(
  userId: string,
  reason?: string
): Promise<boolean> {
  if (!ioInstance) {
    console.warn("[Socket.IO] Cannot disconnect guest - IO instance not available");
    return false;
  }

  await disconnectSoftLockedGuest(ioInstance, userId, reason);
  return true;
}

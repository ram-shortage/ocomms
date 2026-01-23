"use client";

import { io, Socket } from "socket.io-client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ClientToServerEvents, ServerToClientEvents } from "./socket-events";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let connectionRefCount = 0;
let globalHandlersRegistered = false;

/**
 * Get the singleton socket instance.
 * Creates the socket on first call, returns existing instance on subsequent calls.
 */
export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io({
      withCredentials: true, // Send cookies for auth
      autoConnect: false, // Connect manually after auth check
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Register global event handlers (once per socket instance)
    if (!globalHandlersRegistered) {
      // SEC2-04: Rate limit error handler
      socket.on("error", (data: { message: string; code?: string; retryAfter?: number }) => {
        // Only handle rate limit errors here if code is RATE_LIMIT
        // Component-specific handlers (like message-input) may handle this too
        // but they handle UI state, while this ensures toast is always shown
        if (data.code === "RATE_LIMIT") {
          const retrySeconds = Math.ceil((data.retryAfter ?? 5000) / 1000);
          toast.warning(data.message, {
            description: `Please wait ${retrySeconds}s`,
            duration: 3000,
            id: "rate-limit-toast", // Deduplicate if multiple handlers
          });
        }
      });

      // SEC2-16: Guest soft-locked disconnect handler
      socket.on("guest:locked", (data: { reason: string; message: string }) => {
        toast.error(data.reason, {
          description: data.message,
          duration: 10000, // Show longer since user is being disconnected
        });
        // Redirect to home after a brief delay to let user see the message
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      });

      globalHandlersRegistered = true;
    }
  }
  return socket;
}

/**
 * React hook for socket connection management.
 * Uses reference counting to maintain connection across component lifecycles.
 * Only disconnects when all components using the socket have unmounted.
 *
 * @returns The typed socket instance
 */
export function useSocket(): TypedSocket {
  const socketRef = useRef<TypedSocket>(getSocket());

  useEffect(() => {
    const socket = socketRef.current;
    connectionRefCount++;

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      connectionRefCount--;
      // Only disconnect when no components are using the socket
      // and after a delay to allow for navigation between pages
      if (connectionRefCount === 0) {
        setTimeout(() => {
          if (connectionRefCount === 0 && socket.connected) {
            socket.disconnect();
          }
        }, 5000); // 5 second grace period for navigation
      }
    };
  }, []);

  return socketRef.current;
}

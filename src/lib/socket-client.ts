"use client";

import { io, Socket } from "socket.io-client";
import { useEffect, useRef } from "react";
import type { ClientToServerEvents, ServerToClientEvents } from "./socket-events";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let connectionRefCount = 0;

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

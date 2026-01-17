"use client";

import { io, Socket } from "socket.io-client";
import { useEffect, useRef } from "react";
import type { ClientToServerEvents, ServerToClientEvents } from "./socket-events";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

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
 * Connects on mount, disconnects on unmount.
 *
 * @returns The typed socket instance
 */
export function useSocket(): TypedSocket {
  const socketRef = useRef<TypedSocket>(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      // Disconnect on unmount
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}

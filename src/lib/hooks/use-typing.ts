"use client";

import { useCallback, useRef, useEffect } from "react";
import { useSocket } from "@/lib/socket-client";

/** TYPE-05: Throttle typing events to max 1 per 3 seconds */
const TYPING_THROTTLE_MS = 3000;
/** TYPE-03: Auto-hide indicator after 5 seconds of inactivity */
const TYPING_TIMEOUT_MS = 5000;

/**
 * Hook for managing typing indicator emissions.
 * Throttles typing:start events to max 1 per 3 seconds (TYPE-05).
 * Auto-emits typing:stop after 5 seconds of inactivity (TYPE-03).
 *
 * @param targetId - Channel ID or conversation ID
 * @param targetType - "channel" or "dm"
 * @returns { emitTyping, stopTyping }
 */
export function useTyping(targetId: string, targetType: "channel" | "dm") {
  const socket = useSocket();
  const lastEmitRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Emit typing start (throttled).
   * Call this on each keystroke - it will only emit if 3 seconds have passed.
   */
  const emitTyping = useCallback(() => {
    const now = Date.now();

    // Throttle: only emit if 3 seconds since last emit
    if (now - lastEmitRef.current >= TYPING_THROTTLE_MS) {
      socket.emit("typing:start", { targetId, targetType });
      lastEmitRef.current = now;
    }

    // Reset/set 5-second timeout to emit typing:stop
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { targetId, targetType });
      timeoutRef.current = null;
    }, TYPING_TIMEOUT_MS);
  }, [socket, targetId, targetType]);

  /**
   * Emit typing stop immediately.
   * Call this when message is sent (TYPE-04: clears immediately).
   */
  const stopTyping = useCallback(() => {
    // Clear the auto-stop timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Emit stop immediately
    socket.emit("typing:stop", { targetId, targetType });
    // Reset last emit time so next typing can emit immediately
    lastEmitRef.current = 0;
  }, [socket, targetId, targetType]);

  // Cleanup on unmount: clear timeout and emit typing:stop
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Emit stop on unmount to clean up typing state
      socket.emit("typing:stop", { targetId, targetType });
    };
  }, [socket, targetId, targetType]);

  return { emitTyping, stopTyping };
}

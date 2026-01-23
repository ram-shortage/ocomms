"use client";

import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  /** Callback fired when long-press is detected */
  onLongPress: () => void;
  /** Optional callback fired on quick tap (touch end before long-press threshold) */
  onClick?: () => void;
  /** Time in ms to wait before triggering long-press (default: 500ms) */
  delay?: number;
  /** Movement threshold in px to cancel long-press (default: 10px) */
  threshold?: number;
}

interface TouchPosition {
  x: number;
  y: number;
}

interface UseLongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
}

/**
 * Hook for detecting long-press gestures on touch devices.
 *
 * This is touch-only - desktop uses right-click context menus.
 *
 * @example
 * ```tsx
 * const handlers = useLongPress({
 *   onLongPress: () => setShowContextMenu(true),
 *   onClick: () => selectMessage(),
 *   delay: 500,
 *   threshold: 10,
 * });
 *
 * return <div {...handlers}>Message content</div>;
 * ```
 */
export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  threshold = 10,
}: UseLongPressOptions): UseLongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<TouchPosition | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerHapticFeedback = useCallback(() => {
    // Trigger haptic feedback if supported (mainly iOS/Android)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(50);
      } catch {
        // Silently ignore if vibration fails (some browsers block it)
      }
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Record starting position
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      longPressTriggeredRef.current = false;

      // Start the long-press timer
      timerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        triggerHapticFeedback();
        onLongPress();
      }, delay);
    },
    [delay, onLongPress, triggerHapticFeedback]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartPosRef.current) return;

      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);

      // If finger moved beyond threshold, cancel the long-press
      if (deltaX > threshold || deltaY > threshold) {
        clearTimer();
        touchStartPosRef.current = null;
      }
    },
    [threshold, clearTimer]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const wasLongPress = longPressTriggeredRef.current;

      clearTimer();
      touchStartPosRef.current = null;
      longPressTriggeredRef.current = false;

      // If long-press wasn't triggered and we have an onClick handler,
      // treat it as a tap
      if (!wasLongPress && onClick) {
        onClick();
      }
    },
    [clearTimer, onClick]
  );

  return {
    onTouchStart,
    onTouchEnd,
    onTouchMove,
  };
}

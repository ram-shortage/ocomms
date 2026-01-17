"use client";

import { cn } from "@/lib/utils";

export type PresenceStatus = "active" | "away" | "offline";

interface PresenceIndicatorProps {
  status: PresenceStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

const statusClasses = {
  active: "bg-green-500",
  away: "bg-yellow-500",
  offline: "bg-gray-400",
};

/**
 * Visual presence indicator dot.
 * Shows user status with colored dot: green (active), yellow (away), gray (offline).
 */
export function PresenceIndicator({
  status,
  size = "md",
  className,
}: PresenceIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full ring-2 ring-white",
        sizeClasses[size],
        statusClasses[status],
        className
      )}
      title={status.charAt(0).toUpperCase() + status.slice(1)}
      aria-label={`Status: ${status}`}
    />
  );
}

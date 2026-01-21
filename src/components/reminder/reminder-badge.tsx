"use client";

import { useState, useEffect } from "react";
import { getReminders } from "@/lib/actions/reminder";

interface ReminderBadgeProps {
  className?: string;
}

/**
 * Shows a badge with the count of reminders that need attention (fired status).
 */
export function ReminderBadge({ className }: ReminderBadgeProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const reminders = await getReminders(false); // Don't include completed
        // Count only fired reminders (need attention)
        const firedCount = reminders.filter((r) => r.status === "fired").length;
        setCount(firedCount);
      } catch (error) {
        console.error("Failed to fetch reminder count:", error);
      }
    };

    fetchCount();
    // Refresh every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-amber-500 text-white ${className || ""}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

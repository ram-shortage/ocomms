import { cn } from "@/lib/utils";

interface GuestBadgeProps {
  className?: string;
  size?: "sm" | "default";
}

/**
 * GUST-03: Guest badge component
 * Displayed on profiles, member lists, and message headers to identify guests
 */
export function GuestBadge({ className, size = "default" }: GuestBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-medium",
        "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
        size === "sm" ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-xs",
        className
      )}
    >
      Guest
    </span>
  );
}

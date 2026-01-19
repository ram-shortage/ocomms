"use client";

import { ReactNode } from "react";
import { usePullRefresh } from "@/hooks";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  className,
}: PullToRefreshProps) {
  const { containerRef, pullDistance, isRefreshing } = usePullRefresh({
    onRefresh,
  });

  const showIndicator = pullDistance > 0 || isRefreshing;

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full overflow-auto overscroll-y-contain", className)}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2"
          style={{
            top: Math.max(pullDistance - 40, isRefreshing ? 12 : -40),
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 60, 1),
          }}
        >
          <div className="rounded-full bg-background p-2 shadow-md border">
            <Loader2
              className={cn(
                "h-5 w-5 text-muted-foreground",
                isRefreshing && "animate-spin"
              )}
            />
          </div>
        </div>
      )}

      {/* Content - pulled down during gesture, held during refresh */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? 48 : pullDistance}px)`,
          transition: pullDistance === 0 && !isRefreshing ? "transform 200ms" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

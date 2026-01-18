"use client";

import { useOnlineStatus } from "@/lib/pwa/use-online-status";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-muted text-muted-foreground">
      <div className="px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span>You&apos;re offline - some features may be unavailable</span>
      </div>
    </div>
  );
}

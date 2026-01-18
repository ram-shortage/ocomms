"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, RefreshCw } from "lucide-react";

interface UpdateNotificationProps {
  hasUpdate: boolean;
  onRefresh: () => void;
}

export function UpdateNotification({
  hasUpdate,
  onRefresh,
}: UpdateNotificationProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!hasUpdate || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <RefreshCw className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Update available</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A new version of OComms is ready
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button onClick={onRefresh} size="sm">
                Refresh
              </Button>
              <Button
                onClick={() => setDismissed(true)}
                variant="ghost"
                size="sm"
              >
                Later
              </Button>
            </div>
          </div>
          <Button
            onClick={() => setDismissed(true)}
            variant="ghost"
            size="icon-sm"
            className="-mt-1 -mr-1"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

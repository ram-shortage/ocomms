"use client";

import { Loader2 } from "lucide-react";
import type { SendStatus } from "@/lib/cache";

interface MessageStatusProps {
  status?: SendStatus;
  retryCount?: number;
  onRetry?: () => void;
}

/**
 * Visual status indicator for pending/failed messages.
 * Shows sending state, retry count, and retry button for failed messages.
 */
export function MessageStatus({ status, retryCount, onRetry }: MessageStatusProps) {
  // No indicator needed for sent messages or no status
  if (!status || status === "sent") {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-xs mt-1">
      {status === "pending" && (
        <span className="text-gray-400">Sending...</span>
      )}

      {status === "sending" && (
        <span className="text-blue-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Sending
        </span>
      )}

      {status === "failed" && (
        <span className="text-red-500 flex items-center gap-1">
          Failed
          {retryCount && retryCount > 0 && (
            <span className="text-gray-400">({retryCount} retries)</span>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="underline ml-1 hover:text-red-600"
            >
              Retry
            </button>
          )}
        </span>
      )}
    </div>
  );
}

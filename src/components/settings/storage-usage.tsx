"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface StorageData {
  usedBytes: number;
  quotaBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function StorageUsage() {
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStorage = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/storage");
      if (res.ok) {
        setStorage(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const percentUsed = storage
    ? Math.round((storage.usedBytes / storage.quotaBytes) * 100)
    : 0;

  // Determine indicator color based on usage
  const getIndicatorColor = () => {
    if (percentUsed >= 90) return "bg-red-500";
    if (percentUsed >= 80) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Storage Usage</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStorage}
          disabled={loading}
        >
          {loading ? "Loading..." : storage ? "Refresh" : "View Usage"}
        </Button>
      </div>

      {storage && (
        <div className="space-y-2">
          <Progress
            value={percentUsed}
            className="h-2"
            indicatorClassName={getIndicatorColor()}
          />
          <p className="text-sm text-muted-foreground">
            {formatBytes(storage.usedBytes)} of {formatBytes(storage.quotaBytes)}{" "}
            used ({percentUsed}%)
          </p>
          {percentUsed >= 80 && percentUsed < 100 && (
            <p className="text-sm text-yellow-600">
              You are approaching your storage limit. Consider deleting unused
              files.
            </p>
          )}
          {percentUsed >= 100 && (
            <p className="text-sm text-red-600">
              You have reached your storage limit. Delete files to upload more.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

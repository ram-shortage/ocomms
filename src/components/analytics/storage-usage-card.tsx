"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StorageUsageResult } from "@/lib/actions/analytics";

interface StorageUsageCardProps {
  data: StorageUsageResult | null;
  isLoading?: boolean;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * StorageUsageCard - Storage usage by channel
 *
 * ANLY-07: Storage usage
 * - Total storage used (formatted)
 * - Breakdown by channel with horizontal bar chart
 * - Top 5 channels + "Other"
 */
export function StorageUsageCard({ data, isLoading }: StorageUsageCardProps) {
  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">
              {isLoading ? "Loading..." : "No data available"}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-muted-foreground">No files uploaded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Top 5 channels + aggregate others
  const top5 = data.byChannel.slice(0, 5);
  const otherBytes = data.byChannel.slice(5).reduce((sum, c) => sum + c.bytes, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total storage */}
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-3xl font-bold">{formatBytes(data.total)}</div>
          <div className="text-sm text-muted-foreground">Total storage used</div>
        </div>

        {/* Breakdown by channel */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">By Channel</h4>
          <div className="space-y-3">
            {top5.map((channel) => {
              const percentage = (channel.bytes / data.total) * 100;
              return (
                <div key={channel.channelId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">#{channel.channelName}</span>
                    <span className="text-muted-foreground">{formatBytes(channel.bytes)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {otherBytes > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Other ({data.byChannel.length - 5} channels)
                  </span>
                  <span className="text-muted-foreground">{formatBytes(otherBytes)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-muted-foreground/50 rounded-full transition-all"
                    style={{ width: `${(otherBytes / data.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

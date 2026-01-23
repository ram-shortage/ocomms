"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChannelActivity } from "@/lib/actions/analytics";

interface ChannelActivityTableProps {
  data: ChannelActivity[];
  isLoading?: boolean;
}

/**
 * ChannelActivityTable - Top 10 channels by message count
 *
 * ANLY-03: Top 10 channels
 * - Table: Rank, Channel Name, Message Count, % of Total
 * - Top 10 channels, rest aggregated as "Other"
 */
export function ChannelActivityTable({ data, isLoading }: ChannelActivityTableProps) {
  // Calculate total and percentages
  const total = data.reduce((sum, c) => sum + c.messageCount, 0);
  const top10 = data.slice(0, 10);
  const otherCount = data.slice(10).reduce((sum, c) => sum + c.messageCount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-muted-foreground">No channel activity in this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground w-8 sm:w-12">
                    #
                  </th>
                  <th className="text-left py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground">
                    Channel
                  </th>
                  <th className="text-right py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground">
                    Messages
                  </th>
                  <th className="text-right py-3 px-2 text-xs sm:text-sm font-medium text-muted-foreground w-20 sm:w-24">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {top10.map((channel, index) => {
                  const percentage = total > 0 ? ((channel.messageCount / total) * 100).toFixed(1) : "0";
                  return (
                    <tr key={channel.channelId} className="border-b last:border-0">
                      <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="py-2 sm:py-3 px-2">
                        <span className="text-xs sm:text-sm font-medium">#{channel.channelName}</span>
                      </td>
                      <td className="py-2 sm:py-3 px-2 text-right">
                        <span className="text-xs sm:text-sm tabular-nums">
                          {channel.messageCount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 sm:py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <div className="hidden sm:block w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                            {percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {otherCount > 0 && (
                  <tr className="border-t bg-muted/30">
                    <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm text-muted-foreground">-</td>
                    <td className="py-2 sm:py-3 px-2">
                      <span className="text-xs sm:text-sm text-muted-foreground">Other ({data.length - 10})</span>
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-right">
                      <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                        {otherCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-right">
                      <span className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                        {total > 0 ? ((otherCount / total) * 100).toFixed(1) : "0"}%
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
              {total > 0 && (
                <tfoot>
                  <tr className="border-t">
                    <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm font-medium" colSpan={2}>
                      Total
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-right">
                      <span className="text-xs sm:text-sm font-medium tabular-nums">
                        {total.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-right">
                      <span className="text-xs sm:text-sm font-medium tabular-nums">100%</span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

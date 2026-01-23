"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import type { PeakUsageTime } from "@/lib/actions/analytics";

interface PeakTimesChartProps {
  data: PeakUsageTime[];
  isLoading?: boolean;
}

const chartConfig = {
  count: {
    label: "Messages",
    color: "hsl(var(--chart-3))",
  },
};

/**
 * Format hour for display (0-23 to 12am-11pm)
 */
function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

/**
 * PeakTimesChart - Hourly distribution of messages
 *
 * ANLY-06: Hourly distribution
 * - Bar chart with 24 bars (0-23 hours)
 * - Y-axis: message count
 * - Highlights peak hours
 */
export function PeakTimesChart({ data, isLoading }: PeakTimesChartProps) {
  // Fill in all 24 hours (some might be missing from data)
  const allHours = Array.from({ length: 24 }, (_, i) => {
    const existing = data.find((d) => d.hour === i);
    return {
      hour: i,
      hourLabel: formatHour(i),
      count: existing?.count ?? 0,
    };
  });

  // Find peak hour(s)
  const maxCount = Math.max(...allHours.map((h) => h.count));
  const peakHours = allHours.filter((h) => h.count === maxCount && maxCount > 0).map((h) => h.hour);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Peak Usage Times</span>
          {peakHours.length > 0 && maxCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              Peak: {peakHours.map(formatHour).join(", ")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        ) : maxCount === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-muted-foreground">No activity data for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <ChartContainer config={chartConfig} className="h-[180px] sm:h-[200px] min-w-[400px] sm:min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allHours} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis
                    dataKey="hourLabel"
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={30}
                  />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const item = payload[0];
                        if (item?.payload?.hour !== undefined) {
                          return formatHour(item.payload.hour);
                        }
                        return "";
                      }}
                    />
                  }
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {allHours.map((entry) => (
                    <Cell
                      key={`cell-${entry.hour}`}
                      fill={
                        peakHours.includes(entry.hour)
                          ? "hsl(var(--chart-1))"
                          : "var(--color-count)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

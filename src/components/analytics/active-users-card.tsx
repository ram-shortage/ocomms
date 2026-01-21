"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ActiveUsersResult } from "@/lib/actions/analytics";

interface ActiveUsersCardProps {
  data: ActiveUsersResult | null;
  isLoading?: boolean;
}

const chartConfig = {
  count: {
    label: "Active Users",
    color: "hsl(var(--chart-2))",
  },
};

/**
 * ActiveUsersCard - DAU/WAU/MAU metrics with trends
 *
 * ANLY-02: DAU/WAU/MAU
 * - Card with three metrics
 * - Each shows number + trend indicator
 * - Sparkline for DAU history
 */
export function ActiveUsersCard({ data, isLoading }: ActiveUsersCardProps) {
  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Users</CardTitle>
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

  const TrendIcon = data.trend === "up" ? TrendingUp : data.trend === "down" ? TrendingDown : Minus;
  const trendColor = data.trend === "up" ? "text-green-500" : data.trend === "down" ? "text-red-500" : "text-muted-foreground";

  // Calculate average DAU for display
  const avgDau = data.dau.length > 0
    ? Math.round(data.dau.reduce((sum, d) => sum + d.count, 0) / data.dau.length)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Users</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* DAU with sparkline */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Daily Active Users (Avg)</div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{avgDau}</span>
              {data.dau.length > 1 && (
                <ChartContainer config={chartConfig} className="h-[40px] w-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.dau}>
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="var(--color-count)"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </div>
          </div>

          {/* WAU */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Weekly Active Users</div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{data.wau}</span>
              <TrendIcon className={`h-5 w-5 ${trendColor}`} />
            </div>
            <p className="text-xs text-muted-foreground">
              {data.trend === "up" && "Up from last week"}
              {data.trend === "down" && "Down from last week"}
              {data.trend === "flat" && "Same as last week"}
            </p>
          </div>

          {/* MAU */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Monthly Active Users</div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{data.mau}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

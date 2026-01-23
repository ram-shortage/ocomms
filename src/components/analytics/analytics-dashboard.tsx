"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker, type DateRange } from "./date-range-picker";
import { MessageVolumeChart } from "./message-volume-chart";
import { ActiveUsersCard } from "./active-users-card";
import { ChannelActivityTable } from "./channel-activity-table";
import { StorageUsageCard } from "./storage-usage-card";
import { PeakTimesChart } from "./peak-times-chart";
import { ExportButton } from "./export-button";
import {
  getMessageVolume,
  getActiveUsers,
  getChannelActivity,
  getPeakUsageTimes,
  getStorageUsage,
  type MessageVolumePoint,
  type ActiveUsersResult,
  type ChannelActivity,
  type PeakUsageTime,
  type StorageUsageResult,
} from "@/lib/actions/analytics";
import { RefreshCw } from "lucide-react";

interface AnalyticsDashboardProps {
  organizationId: string;
  workspaceSlug: string;
}

/**
 * AnalyticsDashboard - Main analytics dashboard with tabs
 *
 * Per CONTEXT.md: Tabbed sections like Vercel dashboard - clean, data-focused.
 * Manual refresh only (no auto-polling).
 *
 * Layout:
 * - Header: Title, Date Range Picker, Refresh Button, Export Button
 * - Tabs: Messages, Users, Channels, Storage
 */
export function AnalyticsDashboard({
  organizationId,
  workspaceSlug,
}: AnalyticsDashboardProps) {
  // Date range: default last 30 days
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, end };
  });

  const [activeTab, setActiveTab] = useState("messages");
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [messageData, setMessageData] = useState<MessageVolumePoint[]>([]);
  const [usersData, setUsersData] = useState<ActiveUsersResult | null>(null);
  const [channelData, setChannelData] = useState<ChannelActivity[]>([]);
  const [peakData, setPeakData] = useState<PeakUsageTime[]>([]);
  const [storageData, setStorageData] = useState<StorageUsageResult | null>(null);

  // Fetch data for the active tab
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      switch (activeTab) {
        case "messages":
          const [messages, peak] = await Promise.all([
            getMessageVolume(organizationId, dateRange.start, dateRange.end),
            getPeakUsageTimes(organizationId, dateRange.start, dateRange.end),
          ]);
          setMessageData(messages);
          setPeakData(peak);
          break;

        case "users":
          const users = await getActiveUsers(
            organizationId,
            dateRange.start,
            dateRange.end
          );
          setUsersData(users);
          break;

        case "channels":
          const channels = await getChannelActivity(
            organizationId,
            dateRange.start,
            dateRange.end
          );
          setChannelData(channels);
          break;

        case "storage":
          const storage = await getStorageUsage(organizationId);
          setStorageData(storage);
          break;
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, organizationId, dateRange]);

  // Fetch data on tab change or date range change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get current tab data for export
  function getCurrentTabData(): Record<string, unknown>[] {
    switch (activeTab) {
      case "messages":
        return messageData.map((d) => ({ date: d.date, messages: d.count }));
      case "users":
        return usersData?.dau ?? [];
      case "channels":
        return channelData.map((c) => ({
          channel: c.channelName,
          messages: c.messageCount,
        }));
      case "storage":
        return storageData?.byChannel.map((c) => ({
          channel: c.channelName,
          bytes: c.bytes,
          megabytes: (c.bytes / 1024 / 1024).toFixed(2),
        })) ?? [];
      default:
        return [];
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
        {/* Scrollable tabs container for mobile */}
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="messages" className="min-h-11 px-3 sm:px-4">Messages</TabsTrigger>
            <TabsTrigger value="users" className="min-h-11 px-3 sm:px-4">Users</TabsTrigger>
            <TabsTrigger value="channels" className="min-h-11 px-3 sm:px-4">Channels</TabsTrigger>
            <TabsTrigger value="storage" className="min-h-11 px-3 sm:px-4">Storage</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 min-w-11"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="sr-only">Refresh</span>
          </Button>
          <ExportButton
            data={getCurrentTabData()}
            filename={`${workspaceSlug}-analytics-${activeTab}`}
            dateRange={dateRange}
          />
        </div>
      </div>

      <TabsContent value="messages" className="space-y-6">
        <MessageVolumeChart data={messageData} isLoading={isLoading} />
        <PeakTimesChart data={peakData} isLoading={isLoading} />
      </TabsContent>

      <TabsContent value="users" className="space-y-6">
        <ActiveUsersCard data={usersData} isLoading={isLoading} />
      </TabsContent>

      <TabsContent value="channels" className="space-y-6">
        <ChannelActivityTable data={channelData} isLoading={isLoading} />
      </TabsContent>

      <TabsContent value="storage" className="space-y-6">
        <StorageUsageCard data={storageData} isLoading={isLoading} />
      </TabsContent>
    </Tabs>
  );
}

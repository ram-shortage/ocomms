"use server";

import { auth } from "@/lib/auth";
import { db, sql } from "@/db";
import { members, messages, channels, fileAttachments } from "@/db/schema";
import { eq, and, gte, lte, count, countDistinct, sum, inArray } from "drizzle-orm";
import { headers } from "next/headers";

/**
 * Verify the current user has admin/owner access to the organization.
 * Throws if unauthorized.
 */
async function verifyAdminAccess(organizationId: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, organizationId)
    ),
  });

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new Error("Only admins can view analytics");
  }
}

export interface MessageVolumePoint {
  date: string; // YYYY-MM-DD
  count: number;
}

/**
 * ANLY-01: Get message volume over time for an organization.
 * Groups messages by day within the date range.
 */
export async function getMessageVolume(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<MessageVolumePoint[]> {
  await verifyAdminAccess(organizationId);

  // Get all channels in this organization
  const orgChannels = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.organizationId, organizationId));

  if (orgChannels.length === 0) {
    return [];
  }

  const channelIds = orgChannels.map((c) => c.id);

  // Query messages grouped by date, filtered by channels in this org
  const result = await db
    .select({
      date: sql<string>`DATE(${messages.createdAt})`.as("date"),
      count: count(messages.id).as("count"),
    })
    .from(messages)
    .where(
      and(
        inArray(messages.channelId, channelIds),
        gte(messages.createdAt, startDate),
        lte(messages.createdAt, endDate)
      )
    )
    .groupBy(sql`DATE(${messages.createdAt})`)
    .orderBy(sql`DATE(${messages.createdAt})`);

  return result.map((row) => ({
    date: row.date,
    count: Number(row.count),
  }));
}

export interface ActiveUsersResult {
  dau: { date: string; count: number }[];
  wau: number;
  mau: number;
  trend: "up" | "down" | "flat";
}

/**
 * ANLY-02: Get active users (DAU/WAU/MAU) for an organization.
 * Counts distinct message authors in the time periods.
 */
export async function getActiveUsers(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<ActiveUsersResult> {
  await verifyAdminAccess(organizationId);

  // Get all channels in this organization
  const orgChannels = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.organizationId, organizationId));

  if (orgChannels.length === 0) {
    return { dau: [], wau: 0, mau: 0, trend: "flat" };
  }

  const channelIds = orgChannels.map((c) => c.id);

  // DAU: distinct authors per day in range
  const dauResult = await db
    .select({
      date: sql<string>`DATE(${messages.createdAt})`.as("date"),
      count: countDistinct(messages.authorId).as("count"),
    })
    .from(messages)
    .where(
      and(
        inArray(messages.channelId, channelIds),
        gte(messages.createdAt, startDate),
        lte(messages.createdAt, endDate)
      )
    )
    .groupBy(sql`DATE(${messages.createdAt})`)
    .orderBy(sql`DATE(${messages.createdAt})`);

  // WAU: distinct authors in last 7 days from endDate
  const wauStart = new Date(endDate);
  wauStart.setDate(wauStart.getDate() - 7);
  const wauResult = await db
    .select({
      count: countDistinct(messages.authorId).as("count"),
    })
    .from(messages)
    .where(
      and(
        inArray(messages.channelId, channelIds),
        gte(messages.createdAt, wauStart),
        lte(messages.createdAt, endDate)
      )
    );

  // MAU: distinct authors in last 30 days from endDate
  const mauStart = new Date(endDate);
  mauStart.setDate(mauStart.getDate() - 30);
  const mauResult = await db
    .select({
      count: countDistinct(messages.authorId).as("count"),
    })
    .from(messages)
    .where(
      and(
        inArray(messages.channelId, channelIds),
        gte(messages.createdAt, mauStart),
        lte(messages.createdAt, endDate)
      )
    );

  // Calculate trend: compare this week vs previous week
  const previousWauStart = new Date(wauStart);
  previousWauStart.setDate(previousWauStart.getDate() - 7);
  const previousWauEnd = new Date(wauStart);
  previousWauEnd.setDate(previousWauEnd.getDate() - 1);

  const previousWauResult = await db
    .select({
      count: countDistinct(messages.authorId).as("count"),
    })
    .from(messages)
    .where(
      and(
        inArray(messages.channelId, channelIds),
        gte(messages.createdAt, previousWauStart),
        lte(messages.createdAt, previousWauEnd)
      )
    );

  const currentWau = Number(wauResult[0]?.count ?? 0);
  const previousWau = Number(previousWauResult[0]?.count ?? 0);

  let trend: "up" | "down" | "flat" = "flat";
  if (currentWau > previousWau) {
    trend = "up";
  } else if (currentWau < previousWau) {
    trend = "down";
  }

  return {
    dau: dauResult.map((row) => ({
      date: row.date,
      count: Number(row.count),
    })),
    wau: currentWau,
    mau: Number(mauResult[0]?.count ?? 0),
    trend,
  };
}

export interface ChannelActivity {
  channelId: string;
  channelName: string;
  messageCount: number;
}

/**
 * ANLY-03: Get top 10 channels by message count.
 */
export async function getChannelActivity(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<ChannelActivity[]> {
  await verifyAdminAccess(organizationId);

  // Join channels and messages, group by channel, count messages
  const result = await db
    .select({
      channelId: channels.id,
      channelName: channels.name,
      messageCount: count(messages.id).as("message_count"),
    })
    .from(channels)
    .leftJoin(
      messages,
      and(
        eq(messages.channelId, channels.id),
        gte(messages.createdAt, startDate),
        lte(messages.createdAt, endDate)
      )
    )
    .where(eq(channels.organizationId, organizationId))
    .groupBy(channels.id, channels.name)
    .orderBy(sql`message_count DESC`)
    .limit(10);

  return result.map((row) => ({
    channelId: row.channelId,
    channelName: row.channelName,
    messageCount: Number(row.messageCount),
  }));
}

export interface PeakUsageTime {
  hour: number; // 0-23
  count: number;
}

/**
 * ANLY-06: Get hourly distribution of messages (peak usage times).
 */
export async function getPeakUsageTimes(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<PeakUsageTime[]> {
  await verifyAdminAccess(organizationId);

  // Get all channels in this organization
  const orgChannels = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.organizationId, organizationId));

  if (orgChannels.length === 0) {
    return [];
  }

  const channelIds = orgChannels.map((c) => c.id);

  // Extract hour from createdAt and count messages per hour
  const result = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${messages.createdAt})`.as("hour"),
      count: count(messages.id).as("count"),
    })
    .from(messages)
    .where(
      and(
        inArray(messages.channelId, channelIds),
        gte(messages.createdAt, startDate),
        lte(messages.createdAt, endDate)
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM ${messages.createdAt})`)
    .orderBy(sql`hour`);

  return result.map((row) => ({
    hour: Number(row.hour),
    count: Number(row.count),
  }));
}

export interface StorageByChannel {
  channelId: string;
  channelName: string;
  bytes: number;
}

export interface StorageUsageResult {
  total: number;
  byChannel: StorageByChannel[];
}

/**
 * ANLY-07: Get file storage usage for an organization.
 * Sums file sizes grouped by channel.
 */
export async function getStorageUsage(
  organizationId: string
): Promise<StorageUsageResult> {
  await verifyAdminAccess(organizationId);

  // Get all channels in this organization
  const orgChannels = await db
    .select({ id: channels.id, name: channels.name })
    .from(channels)
    .where(eq(channels.organizationId, organizationId));

  if (orgChannels.length === 0) {
    return { total: 0, byChannel: [] };
  }

  const channelIds = orgChannels.map((c) => c.id);
  const channelMap = new Map(orgChannels.map((c) => [c.id, c.name]));

  // Get storage per channel via messages -> file_attachments
  const result = await db
    .select({
      channelId: messages.channelId,
      bytes: sum(fileAttachments.sizeBytes).as("bytes"),
    })
    .from(fileAttachments)
    .innerJoin(messages, eq(fileAttachments.messageId, messages.id))
    .where(inArray(messages.channelId, channelIds))
    .groupBy(messages.channelId);

  const byChannel: StorageByChannel[] = result
    .filter((row): row is typeof row & { channelId: string } => row.channelId !== null)
    .map((row) => ({
      channelId: row.channelId,
      channelName: channelMap.get(row.channelId) ?? "Unknown",
      bytes: Number(row.bytes ?? 0),
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const total = byChannel.reduce((acc, c) => acc + c.bytes, 0);

  return { total, byChannel };
}

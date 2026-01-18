"use server";

import { db } from "@/db";
import { messages, channelMembers, conversationParticipants, users, channels, conversations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { sql, and, or, eq, isNull, inArray, desc } from "drizzle-orm";

export type SearchResult = {
  id: string;
  content: string;
  channelId: string | null;
  conversationId: string | null;
  authorId: string;
  createdAt: Date;
  rank: number;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
  channel?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  conversation?: {
    id: string;
    isGroup: boolean;
  } | null;
};

export async function searchMessages(
  organizationId: string,
  query: string,
  limit: number = 50
): Promise<SearchResult[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Return empty for empty/whitespace queries
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  // Get accessible channel IDs (channels user is member of)
  const channelMemberships = await db.query.channelMembers.findMany({
    where: eq(channelMembers.userId, session.user.id),
    with: { channel: true },
  });
  const accessibleChannelIds = channelMemberships
    .filter((m) => m.channel.organizationId === organizationId)
    .map((m) => m.channelId);

  // Get accessible conversation IDs (conversations user participates in)
  const conversationMemberships = await db.query.conversationParticipants.findMany({
    where: eq(conversationParticipants.userId, session.user.id),
    with: { conversation: true },
  });
  const accessibleConversationIds = conversationMemberships
    .filter((p) => p.conversation.organizationId === organizationId)
    .map((p) => p.conversationId);

  // If user has no accessible channels AND no accessible conversations, return empty
  if (accessibleChannelIds.length === 0 && accessibleConversationIds.length === 0) {
    return [];
  }

  // Build permission condition (messages from channels OR conversations user has access to)
  const permissionCondition = or(
    accessibleChannelIds.length > 0
      ? inArray(messages.channelId, accessibleChannelIds)
      : sql`false`,
    accessibleConversationIds.length > 0
      ? inArray(messages.conversationId, accessibleConversationIds)
      : sql`false`
  );

  // Execute search query with joins
  const results = await db
    .select({
      id: messages.id,
      content: messages.content,
      channelId: messages.channelId,
      conversationId: messages.conversationId,
      authorId: messages.authorId,
      createdAt: messages.createdAt,
      rank: sql<number>`ts_rank(${messages.searchContent}, websearch_to_tsquery('english', ${trimmedQuery}))`,
      authorName: users.name,
      authorImage: users.image,
      channelName: channels.name,
      channelSlug: channels.slug,
      conversationIsGroup: conversations.isGroup,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .leftJoin(channels, eq(messages.channelId, channels.id))
    .leftJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        sql`${messages.searchContent} @@ websearch_to_tsquery('english', ${trimmedQuery})`,
        permissionCondition,
        isNull(messages.deletedAt)
      )
    )
    .orderBy(desc(sql`ts_rank(${messages.searchContent}, websearch_to_tsquery('english', ${trimmedQuery}))`))
    .limit(limit);

  // Transform to SearchResult format
  return results.map((row) => ({
    id: row.id,
    content: row.content,
    channelId: row.channelId,
    conversationId: row.conversationId,
    authorId: row.authorId,
    createdAt: row.createdAt,
    rank: row.rank,
    author: {
      id: row.authorId,
      name: row.authorName || "Unknown",
      image: row.authorImage,
    },
    channel: row.channelId
      ? {
          id: row.channelId,
          name: row.channelName || "",
          slug: row.channelSlug || "",
        }
      : null,
    conversation: row.conversationId
      ? {
          id: row.conversationId,
          isGroup: row.conversationIsGroup ?? false,
        }
      : null,
  }));
}

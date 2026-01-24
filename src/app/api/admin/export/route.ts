import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { auditLog, AuditEventType, getClientIP } from "@/lib/audit-logger";
import {
  organizations,
  members,
  profiles,
  channels,
  messages,
  conversations,
  reactions,
  pinnedMessages,
  notifications,
  channelNotificationSettings,
  channelReadState,
} from "@/db/schema";

interface ExportManifest {
  exportDate: string;
  format: string;
  version: string;
  organizationId: string;
  tables: string[];
  counts: {
    members: number;
    channels: number;
    messages: number;
    conversations: number;
    reactions: number;
    pinnedMessages: number;
    notifications: number;
  };
}

// POST /api/admin/export - Export all organization data as JSON
export async function POST() {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SEC2-08 FIX: Derive organizationId from authenticated user's ownership
    // NEVER use organizationId from request body - that would allow cross-tenant export
    const ownerMembership = await db.query.members.findFirst({
      where: and(
        eq(members.userId, session.user.id),
        eq(members.role, "owner")
      ),
    });

    if (!ownerMembership) {
      // Log security event for unauthorized attempt
      await auditLog({
        eventType: AuditEventType.AUTHZ_FAILURE,
        userId: session.user.id,
        ip: getClientIP(await headers()),
        details: {
          action: "data_export",
          reason: "not_owner"
        }
      });
      return NextResponse.json(
        { error: "Only organization owners can export data" },
        { status: 403 }
      );
    }

    // Use ONLY the derived organizationId - never from request body
    const organizationId = ownerMembership.organizationId;

    // Get organization details (membership proves it exists)
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    // Export all organization data
    console.log(`Exporting organization ${organizationId} for user ${session.user.id}`);

    // 1. Get organization members with user info (excluding sensitive auth data)
    const orgMembers = await db.query.members.findMany({
      where: eq(members.organizationId, organizationId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            image: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    // PERF FIX: Batch query for profiles instead of N+1
    const memberUserIds = orgMembers.map((m) => m.userId);
    const allProfiles = memberUserIds.length > 0
      ? await db.query.profiles.findMany({
          where: inArray(profiles.userId, memberUserIds),
        })
      : [];

    const membersWithProfiles = orgMembers.map((member) => ({
      ...member,
      profile: allProfiles.find((p) => p.userId === member.userId) || null,
    }));

    // 2. Get channels with members and messages
    // PERF FIX: Use batched queries instead of N+1
    const orgChannels = await db.query.channels.findMany({
      where: eq(channels.organizationId, organizationId),
      with: {
        members: true,
      },
    });

    // Get all channel IDs for batch queries
    const channelIds = orgChannels.map((c) => c.id);

    // Batch query: all channel messages at once
    const allChannelMessages = channelIds.length > 0
      ? await db.query.messages.findMany({
          where: inArray(messages.channelId, channelIds),
        })
      : [];
    const totalMessages = allChannelMessages.length;

    // Batch query: all reactions for channel messages at once
    const channelMessageIds = allChannelMessages.map((m) => m.id);
    const allChannelReactions = channelMessageIds.length > 0
      ? await db.query.reactions.findMany({
          where: inArray(reactions.messageId, channelMessageIds),
        })
      : [];

    // Group messages by channel and attach reactions
    const channelsWithMessages = orgChannels.map((channel) => {
      const channelMessages = allChannelMessages.filter((m) => m.channelId === channel.id);
      return {
        ...channel,
        messages: channelMessages.map((msg) => ({
          ...msg,
          reactions: allChannelReactions.filter((r) => r.messageId === msg.id),
        })),
      };
    });

    // 3. Get direct messages (conversations)
    // PERF FIX: Use batched queries instead of N+1
    const orgConversations = await db.query.conversations.findMany({
      where: eq(conversations.organizationId, organizationId),
      with: {
        participants: true,
      },
    });
    const conversationIds = orgConversations.map((c) => c.id);

    // Batch query: all conversation messages at once
    const allConvMessages = conversationIds.length > 0
      ? await db.query.messages.findMany({
          where: inArray(messages.conversationId, conversationIds),
        })
      : [];
    const totalDmMessages = allConvMessages.length;

    // Batch query: all reactions for conversation messages at once
    const convMessageIds = allConvMessages.map((m) => m.id);
    const allConvReactions = convMessageIds.length > 0
      ? await db.query.reactions.findMany({
          where: inArray(reactions.messageId, convMessageIds),
        })
      : [];

    // Group messages by conversation and attach reactions
    const conversationsWithMessages = orgConversations.map((conversation) => {
      const convMessages = allConvMessages.filter((m) => m.conversationId === conversation.id);
      return {
        ...conversation,
        messages: convMessages.map((msg) => ({
          ...msg,
          reactions: allConvReactions.filter((r) => r.messageId === msg.id),
        })),
      };
    });

    // 4. Get pinned messages
    // PERF FIX: Single batch query instead of N+1
    const allPinnedMessages = channelIds.length > 0
      ? await db.query.pinnedMessages.findMany({
          where: inArray(pinnedMessages.channelId, channelIds),
        })
      : [];

    // 5. Get notifications for org members
    // SECURITY FIX: Only include notifications from THIS organization's channels/conversations
    // Must use explicit Set lookups to prevent cross-organization data leakage
    // PERF FIX: Single batch query for all member notifications, then filter
    const channelIdSet = new Set(channelIds);
    const conversationIdSet = new Set(conversationIds);

    const allUserNotifications = memberUserIds.length > 0
      ? await db.query.notifications.findMany({
          where: inArray(notifications.userId, memberUserIds),
        })
      : [];

    // Filter to ONLY notifications for this org's channels/conversations
    // Both conditions require explicit membership in org's channel/conversation sets
    const allNotifications = allUserNotifications.filter(
      (n) =>
        (n.channelId !== null && channelIdSet.has(n.channelId)) ||
        (n.conversationId !== null && conversationIdSet.has(n.conversationId))
    );

    // 6. Get channel notification settings
    // PERF FIX: Single batch query instead of N+1
    const allNotificationSettings = channelIds.length > 0
      ? await db.query.channelNotificationSettings.findMany({
          where: inArray(channelNotificationSettings.channelId, channelIds),
        })
      : [];

    // 7. Get read states
    // PERF FIX: Two batch queries instead of N+1 (channels + conversations)
    const channelReadStates = channelIds.length > 0
      ? await db.query.channelReadState.findMany({
          where: inArray(channelReadState.channelId, channelIds),
        })
      : [];

    const conversationReadStates = conversationIds.length > 0
      ? await db.query.channelReadState.findMany({
          where: inArray(channelReadState.conversationId, conversationIds),
        })
      : [];

    const allReadStates = [...channelReadStates, ...conversationReadStates];

    // Count total reactions (already batched above)
    const totalReactions = allChannelReactions.length + allConvReactions.length;

    // Build manifest
    const manifest: ExportManifest = {
      exportDate: new Date().toISOString(),
      format: "JSON",
      version: "1.0",
      organizationId,
      tables: [
        "organizations",
        "members",
        "users",
        "profiles",
        "channels",
        "channel_members",
        "messages",
        "conversations",
        "conversation_participants",
        "reactions",
        "pinned_messages",
        "notifications",
        "channel_notification_settings",
        "channel_read_state",
      ],
      counts: {
        members: orgMembers.length,
        channels: orgChannels.length,
        messages: totalMessages + totalDmMessages,
        conversations: orgConversations.length,
        reactions: totalReactions,
        pinnedMessages: allPinnedMessages.length,
        notifications: allNotifications.length,
      },
    };

    // Build export object
    const exportData = {
      manifest,
      organization,
      members: membersWithProfiles,
      channels: channelsWithMessages,
      directMessages: conversationsWithMessages,
      pinnedMessages: allPinnedMessages,
      notifications: allNotifications,
      channelNotificationSettings: allNotificationSettings,
      readStates: allReadStates,
    };

    // Log successful export
    auditLog({
      eventType: AuditEventType.ADMIN_EXPORT_DATA,
      userId: session.user.id,
      organizationId,
      ip: getClientIP(await headers()),
      details: {
        memberCount: manifest.counts.members,
        messageCount: manifest.counts.messages,
      },
    });

    // Create response with download headers
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `ocomms-export-${timestamp}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export organization data" },
      { status: 500 }
    );
  }
}

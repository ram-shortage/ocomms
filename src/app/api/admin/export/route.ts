import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  organizations,
  members,
  users,
  profiles,
  channels,
  channelMembers,
  messages,
  conversations,
  conversationParticipants,
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
export async function POST(request: Request) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    // Verify organization exists
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify user is owner of the organization
    const userMembership = await db.query.members.findFirst({
      where: and(
        eq(members.userId, session.user.id),
        eq(members.organizationId, organizationId)
      ),
    });

    if (!userMembership || userMembership.role !== "owner") {
      return NextResponse.json(
        { error: "Only organization owners can export data" },
        { status: 403 }
      );
    }

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

    // Get profiles for each member
    const memberUserIds = orgMembers.map((m) => m.userId);
    const allProfiles: (typeof profiles.$inferSelect)[] = [];
    for (const userId of memberUserIds) {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
      });
      if (profile) allProfiles.push(profile);
    }

    const membersWithProfiles = orgMembers.map((member) => ({
      ...member,
      profile: allProfiles.find((p) => p.userId === member.userId) || null,
    }));

    // 2. Get channels with members and messages
    const orgChannels = await db.query.channels.findMany({
      where: eq(channels.organizationId, organizationId),
      with: {
        members: true,
      },
    });

    const channelsWithMessages = [];
    let totalMessages = 0;
    for (const channel of orgChannels) {
      const channelMessages = await db.query.messages.findMany({
        where: eq(messages.channelId, channel.id),
      });
      totalMessages += channelMessages.length;

      // Get reactions for these messages
      const messageIds = channelMessages.map((m) => m.id);
      const messageReactions: (typeof reactions.$inferSelect)[] = [];
      for (const messageId of messageIds) {
        const reacts = await db.query.reactions.findMany({
          where: eq(reactions.messageId, messageId),
        });
        messageReactions.push(...reacts);
      }

      channelsWithMessages.push({
        ...channel,
        messages: channelMessages.map((msg) => ({
          ...msg,
          reactions: messageReactions.filter((r) => r.messageId === msg.id),
        })),
      });
    }

    // 3. Get direct messages (conversations)
    const orgConversations = await db.query.conversations.findMany({
      where: eq(conversations.organizationId, organizationId),
      with: {
        participants: true,
      },
    });
    const conversationIds = orgConversations.map((c) => c.id);

    const conversationsWithMessages = [];
    let totalDmMessages = 0;
    for (const conversation of orgConversations) {
      const convMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conversation.id),
      });
      totalDmMessages += convMessages.length;

      // Get reactions for these messages
      const messageIds = convMessages.map((m) => m.id);
      const messageReactions: (typeof reactions.$inferSelect)[] = [];
      for (const messageId of messageIds) {
        const reacts = await db.query.reactions.findMany({
          where: eq(reactions.messageId, messageId),
        });
        messageReactions.push(...reacts);
      }

      conversationsWithMessages.push({
        ...conversation,
        messages: convMessages.map((msg) => ({
          ...msg,
          reactions: messageReactions.filter((r) => r.messageId === msg.id),
        })),
      });
    }

    // 4. Get pinned messages
    const channelIds = orgChannels.map((c) => c.id);
    const allPinnedMessages: (typeof pinnedMessages.$inferSelect)[] = [];
    for (const channelId of channelIds) {
      const pins = await db.query.pinnedMessages.findMany({
        where: eq(pinnedMessages.channelId, channelId),
      });
      allPinnedMessages.push(...pins);
    }

    // 5. Get notifications for org members
    const allNotifications: (typeof notifications.$inferSelect)[] = [];
    for (const member of orgMembers) {
      const userNotifications = await db.query.notifications.findMany({
        where: eq(notifications.userId, member.userId),
      });
      // Filter to only notifications for this org's channels/conversations
      const orgNotifications = userNotifications.filter(
        (n) =>
          (n.channelId && channelIds.includes(n.channelId)) ||
          (n.conversationId && conversationIds.includes(n.conversationId))
      );
      allNotifications.push(...orgNotifications);
    }

    // 6. Get channel notification settings
    const allNotificationSettings: (typeof channelNotificationSettings.$inferSelect)[] = [];
    for (const channelId of channelIds) {
      const settings = await db.query.channelNotificationSettings.findMany({
        where: eq(channelNotificationSettings.channelId, channelId),
      });
      allNotificationSettings.push(...settings);
    }

    // 7. Get read states
    const allReadStates: (typeof channelReadState.$inferSelect)[] = [];
    for (const channelId of channelIds) {
      const states = await db.query.channelReadState.findMany({
        where: eq(channelReadState.channelId, channelId),
      });
      allReadStates.push(...states);
    }
    for (const conversation of orgConversations) {
      const states = await db.query.channelReadState.findMany({
        where: eq(channelReadState.conversationId, conversation.id),
      });
      allReadStates.push(...states);
    }

    // Count total reactions
    let totalReactions = 0;
    for (const channel of channelsWithMessages) {
      for (const msg of channel.messages) {
        totalReactions += msg.reactions.length;
      }
    }
    for (const conv of conversationsWithMessages) {
      for (const msg of conv.messages) {
        totalReactions += msg.reactions.length;
      }
    }

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

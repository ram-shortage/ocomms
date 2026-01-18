import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

// Create database connection
const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}
const client = postgres(connectionString);
const db = drizzle(client, { schema, casing: "snake_case" });

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

export async function exportOrganizationData(
  organizationId: string,
  outputDir: string
): Promise<void> {
  // Create timestamped export directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportDir = path.join(outputDir, `ocomms-export-${timestamp}`);
  fs.mkdirSync(exportDir, { recursive: true });

  console.log(`Exporting organization ${organizationId} to ${exportDir}`);

  // 1. Export organization details
  const organization = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, organizationId),
  });

  if (!organization) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  fs.writeFileSync(
    path.join(exportDir, "organization.json"),
    JSON.stringify(organization, null, 2)
  );
  console.log("Exported organization.json");

  // 2. Export members with user info (excluding sensitive auth data)
  const members = await db.query.members.findMany({
    where: eq(schema.members.organizationId, organizationId),
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
  const memberUserIds = members.map((m) => m.userId);
  const profiles = await db.query.profiles.findMany({
    where: memberUserIds.length > 0 ? eq(schema.profiles.userId, memberUserIds[0]) : undefined,
  });

  // Fetch all profiles
  const allProfiles: typeof profiles = [];
  for (const userId of memberUserIds) {
    const profile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.userId, userId),
    });
    if (profile) allProfiles.push(profile);
  }

  const membersWithProfiles = members.map((member) => ({
    ...member,
    profile: allProfiles.find((p) => p.userId === member.userId) || null,
  }));

  fs.writeFileSync(
    path.join(exportDir, "members.json"),
    JSON.stringify(membersWithProfiles, null, 2)
  );
  console.log(`Exported ${members.length} members`);

  // 3. Export channels with members and messages
  const channels = await db.query.channels.findMany({
    where: eq(schema.channels.organizationId, organizationId),
    with: {
      members: true,
    },
  });

  // Get messages for each channel
  const channelsWithMessages = [];
  let totalMessages = 0;
  for (const channel of channels) {
    const messages = await db.query.messages.findMany({
      where: eq(schema.messages.channelId, channel.id),
    });
    totalMessages += messages.length;

    // Get reactions for these messages
    const messageIds = messages.map((m) => m.id);
    const reactions: typeof schema.reactions.$inferSelect[] = [];
    for (const messageId of messageIds) {
      const messageReactions = await db.query.reactions.findMany({
        where: eq(schema.reactions.messageId, messageId),
      });
      reactions.push(...messageReactions);
    }

    channelsWithMessages.push({
      ...channel,
      messages: messages.map((msg) => ({
        ...msg,
        reactions: reactions.filter((r) => r.messageId === msg.id),
      })),
    });
  }

  fs.writeFileSync(
    path.join(exportDir, "channels.json"),
    JSON.stringify(channelsWithMessages, null, 2)
  );
  console.log(`Exported ${channels.length} channels with ${totalMessages} messages`);

  // 4. Export direct messages (conversations)
  const conversations = await db.query.conversations.findMany({
    where: eq(schema.conversations.organizationId, organizationId),
    with: {
      participants: true,
    },
  });

  // Get messages for each conversation
  const conversationsWithMessages = [];
  let totalDmMessages = 0;
  for (const conversation of conversations) {
    const messages = await db.query.messages.findMany({
      where: eq(schema.messages.conversationId, conversation.id),
    });
    totalDmMessages += messages.length;

    // Get reactions for these messages
    const messageIds = messages.map((m) => m.id);
    const reactions: typeof schema.reactions.$inferSelect[] = [];
    for (const messageId of messageIds) {
      const messageReactions = await db.query.reactions.findMany({
        where: eq(schema.reactions.messageId, messageId),
      });
      reactions.push(...messageReactions);
    }

    conversationsWithMessages.push({
      ...conversation,
      messages: messages.map((msg) => ({
        ...msg,
        reactions: reactions.filter((r) => r.messageId === msg.id),
      })),
    });
  }

  fs.writeFileSync(
    path.join(exportDir, "direct-messages.json"),
    JSON.stringify(conversationsWithMessages, null, 2)
  );
  console.log(`Exported ${conversations.length} conversations with ${totalDmMessages} messages`);

  // 5. Export pinned messages
  const channelIds = channels.map((c) => c.id);
  const pinnedMessages: typeof schema.pinnedMessages.$inferSelect[] = [];
  for (const channelId of channelIds) {
    const pins = await db.query.pinnedMessages.findMany({
      where: eq(schema.pinnedMessages.channelId, channelId),
    });
    pinnedMessages.push(...pins);
  }

  fs.writeFileSync(
    path.join(exportDir, "pinned-messages.json"),
    JSON.stringify(pinnedMessages, null, 2)
  );
  console.log(`Exported ${pinnedMessages.length} pinned messages`);

  // 6. Export notifications for org members
  const notifications: typeof schema.notifications.$inferSelect[] = [];
  for (const member of members) {
    const userNotifications = await db.query.notifications.findMany({
      where: eq(schema.notifications.userId, member.userId),
    });
    // Filter to only notifications for this org's channels
    const orgNotifications = userNotifications.filter(
      (n) => channelIds.includes(n.channelId!) || n.conversationId
    );
    notifications.push(...orgNotifications);
  }

  fs.writeFileSync(
    path.join(exportDir, "notifications.json"),
    JSON.stringify(notifications, null, 2)
  );
  console.log(`Exported ${notifications.length} notifications`);

  // 7. Export channel notification settings
  const notificationSettings: typeof schema.channelNotificationSettings.$inferSelect[] = [];
  for (const channelId of channelIds) {
    const settings = await db.query.channelNotificationSettings.findMany({
      where: eq(schema.channelNotificationSettings.channelId, channelId),
    });
    notificationSettings.push(...settings);
  }

  fs.writeFileSync(
    path.join(exportDir, "channel-notification-settings.json"),
    JSON.stringify(notificationSettings, null, 2)
  );
  console.log(`Exported ${notificationSettings.length} channel notification settings`);

  // 8. Export read states
  const readStates: typeof schema.channelReadState.$inferSelect[] = [];
  for (const channelId of channelIds) {
    const states = await db.query.channelReadState.findMany({
      where: eq(schema.channelReadState.channelId, channelId),
    });
    readStates.push(...states);
  }
  for (const conversation of conversations) {
    const states = await db.query.channelReadState.findMany({
      where: eq(schema.channelReadState.conversationId, conversation.id),
    });
    readStates.push(...states);
  }

  fs.writeFileSync(
    path.join(exportDir, "read-states.json"),
    JSON.stringify(readStates, null, 2)
  );
  console.log(`Exported ${readStates.length} read states`);

  // 9. Count reactions total
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

  // 10. Create manifest
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
      members: members.length,
      channels: channels.length,
      messages: totalMessages + totalDmMessages,
      conversations: conversations.length,
      reactions: totalReactions,
      pinnedMessages: pinnedMessages.length,
      notifications: notifications.length,
    },
  };

  fs.writeFileSync(
    path.join(exportDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log("Created manifest.json");

  console.log(`\nExport complete: ${exportDir}`);
  console.log(`Total records exported:`);
  console.log(`  - Members: ${manifest.counts.members}`);
  console.log(`  - Channels: ${manifest.counts.channels}`);
  console.log(`  - Messages: ${manifest.counts.messages}`);
  console.log(`  - Conversations: ${manifest.counts.conversations}`);
  console.log(`  - Reactions: ${manifest.counts.reactions}`);
  console.log(`  - Pinned messages: ${manifest.counts.pinnedMessages}`);
  console.log(`  - Notifications: ${manifest.counts.notifications}`);
}

// Main function - CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: tsx scripts/export-data.ts <organization-id> <output-dir>");
    console.error("Example: tsx scripts/export-data.ts 123e4567-e89b-12d3-a456-426614174000 ./exports");
    process.exit(1);
  }

  const [organizationId, outputDir] = args;

  try {
    await exportOrganizationData(organizationId, outputDir);
  } catch (error) {
    console.error("Export failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

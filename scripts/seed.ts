/**
 * Seed script for OComms test data
 *
 * Creates comprehensive test data covering all features:
 * - Users with credentials
 * - Organizations (workspaces)
 * - Channels (public and private)
 * - Direct messages (1:1 and group)
 * - Messages with threads
 * - Reactions, pins, notifications
 * - Read states and notification settings
 *
 * Usage: npm run db:seed
 *
 * SECURITY: This script creates test users with known passwords.
 * It MUST NOT be run in production environments.
 */

import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
// Use better-auth's password hashing (scrypt-based)
import { hashPassword } from "better-auth/crypto";

// ============================================
// PRODUCTION SAFETY CHECK - TEST DATA PROHIBITED
// ============================================
const PRODUCTION_INDICATORS = [
  "rds.amazonaws.com",
  "supabase.co",
  "neon.tech",
  "planetscale.com",
  "cockroachlabs.cloud",
  "digitalocean.com",
  "azure.com",
  "gcp.com",
  "render.com",
  "railway.app",
  "fly.io",
  "heroku",
  ".prod.",
  "-prod-",
  "-production",
  ".production.",
];

function isProductionDatabase(): boolean {
  const dbUrl = process.env.DATABASE_URL || "";
  return PRODUCTION_INDICATORS.some((indicator) =>
    dbUrl.toLowerCase().includes(indicator.toLowerCase())
  );
}

function checkProductionSafety(): void {
  const isProduction = isProductionDatabase() || process.env.NODE_ENV === "production";

  if (isProduction) {
    console.error("\n" + "=".repeat(60));
    console.error("  REFUSED: Cannot seed test data in production");
    console.error("=".repeat(60));
    console.error("\nThis script creates test users with known passwords.");
    console.error("Running it in production would create security vulnerabilities.\n");
    console.error("DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
    console.error("NODE_ENV:", process.env.NODE_ENV || "(not set)");
    console.error("\nThis operation is not allowed. No override is available.\n");
    process.exit(1);
  }
}

// Run safety check immediately on script load
checkProductionSafety();

// Helper to generate IDs like better-auth does
const genId = () => nanoid(24);

// Test users data
const TEST_PASSWORD = "TheOrder2026!!"; // All test users use this password

interface UserSeed {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

const usersData: UserSeed[] = [
  { id: genId(), name: "Alice Chen", email: "alice@example.com", emailVerified: true },
  { id: genId(), name: "Bob Martinez", email: "bob@example.com", emailVerified: true },
  { id: genId(), name: "Carol Williams", email: "carol@example.com", emailVerified: true },
  { id: genId(), name: "David Kim", email: "david@example.com", emailVerified: true },
  { id: genId(), name: "Emma Johnson", email: "emma@example.com", emailVerified: true },
  { id: genId(), name: "Frank Brown", email: "frank@example.com", emailVerified: true },
  { id: genId(), name: "Grace Lee", email: "grace@example.com", emailVerified: true },
  { id: genId(), name: "Henry Wilson", email: "henry@example.com", emailVerified: true },
];

// Organization (workspace) data with varying visibility policies
interface OrgSeed {
  id: string;
  name: string;
  slug: string;
  joinPolicy: "invite_only" | "request" | "open";
  description?: string;
}

const orgsData: OrgSeed[] = [
  {
    id: genId(),
    name: "Acme Corp",
    slug: "acme-corp",
    joinPolicy: "invite_only",
    description: "Private corporate workspace - invitation only"
  },
  {
    id: genId(),
    name: "Startup Labs",
    slug: "startup-labs",
    joinPolicy: "request",
    description: "Innovation hub for startups - request access to join our community"
  },
  {
    id: genId(),
    name: "Open Community",
    slug: "open-community",
    joinPolicy: "open",
    description: "Public workspace - everyone is welcome to join instantly"
  },
  {
    id: genId(),
    name: "Enterprise Solutions",
    slug: "enterprise-solutions",
    joinPolicy: "request",
    description: "Enterprise-grade collaboration for business teams"
  },
];

async function seed() {
  console.log("Starting seed...\n");

  const hashedPassword = await hashPassword(TEST_PASSWORD);
  const now = new Date();

  // ============================================
  // 1. CREATE USERS
  // ============================================
  console.log("Creating users...");

  for (const userData of usersData) {
    await db.insert(schema.users).values({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      emailVerified: userData.emailVerified,
      createdAt: now,
      updatedAt: now,
    });

    // Create account (credential) for each user
    await db.insert(schema.accounts).values({
      id: genId(),
      userId: userData.id,
      accountId: userData.id,
      providerId: "credential",
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`  Created ${usersData.length} users\n`);

  // ============================================
  // 2. CREATE PROFILES
  // ============================================
  console.log("Creating profiles...");

  const profilesData = [
    { userId: usersData[0].id, displayName: "Alice", bio: "Engineering Lead - Working on the new API" },
    { userId: usersData[1].id, displayName: "Bob", bio: "Senior Developer - In meetings until 3pm" },
    { userId: usersData[2].id, displayName: "Carol", bio: "Product Manager - Reviewing sprint planning" },
    { userId: usersData[3].id, displayName: "David", bio: "DevOps Engineer - Deploying to staging" },
    { userId: usersData[4].id, displayName: "Emma", bio: "UX Designer - Design review at 2pm" },
    { userId: usersData[5].id, displayName: "Frank", bio: "QA Engineer - Testing new features" },
    { userId: usersData[6].id, displayName: "Grace", bio: "Frontend Developer - Working from home" },
    { userId: usersData[7].id, displayName: "Henry", bio: "Backend Developer - Code review time" },
  ];

  for (const profile of profilesData) {
    await db.insert(schema.profiles).values({
      userId: profile.userId,
      displayName: profile.displayName,
      bio: profile.bio,
    });
  }
  console.log(`  Created ${profilesData.length} profiles\n`);

  // ============================================
  // 3. CREATE ORGANIZATIONS
  // ============================================
  console.log("Creating organizations...");

  for (const org of orgsData) {
    await db.insert(schema.organizations).values({
      id: org.id,
      name: org.name,
      slug: org.slug,
      joinPolicy: org.joinPolicy,
      description: org.description,
      createdAt: now,
    });
  }
  console.log(`  Created ${orgsData.length} organizations\n`);

  // ============================================
  // 4. CREATE MEMBERS (org memberships)
  // ============================================
  console.log("Creating organization memberships...");

  interface MemberSeed {
    orgId: string;
    userId: string;
    role: string;
    isGuest?: boolean;
    guestExpiresAt?: Date;
  }

  // Acme Corp (invite_only): Alice (owner), Bob (admin), Carol, David, Emma
  const acmeMembers: MemberSeed[] = [
    { orgId: orgsData[0].id, userId: usersData[0].id, role: "owner" },
    { orgId: orgsData[0].id, userId: usersData[1].id, role: "admin" },
    { orgId: orgsData[0].id, userId: usersData[2].id, role: "member" },
    { orgId: orgsData[0].id, userId: usersData[3].id, role: "member" },
    { orgId: orgsData[0].id, userId: usersData[4].id, role: "member" },
  ];

  // Startup Labs (request): Frank (owner), Grace (admin), Henry, Alice
  const startupMembers: MemberSeed[] = [
    { orgId: orgsData[1].id, userId: usersData[5].id, role: "owner" },
    { orgId: orgsData[1].id, userId: usersData[6].id, role: "admin" },
    { orgId: orgsData[1].id, userId: usersData[7].id, role: "member" },
    { orgId: orgsData[1].id, userId: usersData[0].id, role: "member" },
  ];

  // Open Community (open): Carol (owner), David (admin), Emma, Frank, Grace - plus guest
  const openCommunityMembers: MemberSeed[] = [
    { orgId: orgsData[2].id, userId: usersData[2].id, role: "owner" },
    { orgId: orgsData[2].id, userId: usersData[3].id, role: "admin" },
    { orgId: orgsData[2].id, userId: usersData[4].id, role: "member" },
    { orgId: orgsData[2].id, userId: usersData[5].id, role: "member" },
    { orgId: orgsData[2].id, userId: usersData[6].id, role: "member" },
    // Guest member with expiration
    {
      orgId: orgsData[2].id,
      userId: usersData[7].id,
      role: "member",
      isGuest: true,
      guestExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    },
  ];

  // Enterprise Solutions (request): Bob (owner), Alice (admin), Henry, David
  const enterpriseMembers: MemberSeed[] = [
    { orgId: orgsData[3].id, userId: usersData[1].id, role: "owner" },
    { orgId: orgsData[3].id, userId: usersData[0].id, role: "admin" },
    { orgId: orgsData[3].id, userId: usersData[7].id, role: "member" },
    { orgId: orgsData[3].id, userId: usersData[3].id, role: "member" },
  ];

  const allMembers = [...acmeMembers, ...startupMembers, ...openCommunityMembers, ...enterpriseMembers];
  const memberIdMap: Map<string, string> = new Map(); // key: `${orgId}:${userId}`, value: memberId

  for (const m of allMembers) {
    const memberId = genId();
    memberIdMap.set(`${m.orgId}:${m.userId}`, memberId);

    await db.insert(schema.members).values({
      id: memberId,
      organizationId: m.orgId,
      userId: m.userId,
      role: m.role,
      isGuest: m.isGuest || false,
      guestExpiresAt: m.guestExpiresAt,
      createdAt: now,
    });
  }
  console.log(`  Created ${allMembers.length} memberships\n`);

  // ============================================
  // 5. CREATE CHANNELS
  // ============================================
  console.log("Creating channels...");

  interface ChannelSeed {
    id: string;
    orgId: string;
    name: string;
    slug: string;
    description: string;
    topic?: string;
    isPrivate: boolean;
    createdBy: string;
  }

  const channelsData: ChannelSeed[] = [
    // Acme Corp channels (invite_only workspace)
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "general", slug: "general", description: "Company-wide announcements and general discussion", topic: "Welcome to Acme Corp!", isPrivate: false, createdBy: usersData[0].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "engineering", slug: "engineering", description: "Engineering team discussions", topic: "Q1 Goals: Ship v2.0", isPrivate: false, createdBy: usersData[0].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "random", slug: "random", description: "Non-work banter and water cooler chat", isPrivate: false, createdBy: usersData[1].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "product", slug: "product", description: "Product planning and roadmap discussions", topic: "Roadmap review every Tuesday", isPrivate: false, createdBy: usersData[2].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "leadership", slug: "leadership", description: "Private channel for leadership team", isPrivate: true, createdBy: usersData[0].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "design", slug: "design", description: "Design team collaboration", topic: "Design system v3 in progress", isPrivate: false, createdBy: usersData[4].id },
    // Startup Labs channels (request workspace)
    { id: crypto.randomUUID(), orgId: orgsData[1].id, name: "general", slug: "general", description: "General discussion for Startup Labs", topic: "Let's build something great!", isPrivate: false, createdBy: usersData[5].id },
    { id: crypto.randomUUID(), orgId: orgsData[1].id, name: "dev", slug: "dev", description: "Development discussions", isPrivate: false, createdBy: usersData[6].id },
    { id: crypto.randomUUID(), orgId: orgsData[1].id, name: "founders", slug: "founders", description: "Private founder discussions", isPrivate: true, createdBy: usersData[5].id },
    // Open Community channels (open workspace)
    { id: crypto.randomUUID(), orgId: orgsData[2].id, name: "general", slug: "general", description: "Welcome to the Open Community!", topic: "Everyone is welcome here!", isPrivate: false, createdBy: usersData[2].id },
    { id: crypto.randomUUID(), orgId: orgsData[2].id, name: "introductions", slug: "introductions", description: "Introduce yourself to the community", isPrivate: false, createdBy: usersData[2].id },
    { id: crypto.randomUUID(), orgId: orgsData[2].id, name: "help", slug: "help", description: "Get help and support", topic: "Ask anything!", isPrivate: false, createdBy: usersData[3].id },
    { id: crypto.randomUUID(), orgId: orgsData[2].id, name: "off-topic", slug: "off-topic", description: "Casual conversations", isPrivate: false, createdBy: usersData[4].id },
    { id: crypto.randomUUID(), orgId: orgsData[2].id, name: "moderators", slug: "moderators", description: "Private channel for community moderators", isPrivate: true, createdBy: usersData[2].id },
    // Enterprise Solutions channels (request workspace)
    { id: crypto.randomUUID(), orgId: orgsData[3].id, name: "general", slug: "general", description: "Enterprise team announcements", topic: "Building enterprise solutions", isPrivate: false, createdBy: usersData[1].id },
    { id: crypto.randomUUID(), orgId: orgsData[3].id, name: "sales", slug: "sales", description: "Sales team discussions", isPrivate: false, createdBy: usersData[1].id },
    { id: crypto.randomUUID(), orgId: orgsData[3].id, name: "support", slug: "support", description: "Customer support coordination", isPrivate: false, createdBy: usersData[0].id },
    { id: crypto.randomUUID(), orgId: orgsData[3].id, name: "executive", slug: "executive", description: "Private executive discussions", isPrivate: true, createdBy: usersData[1].id },
  ];

  for (const ch of channelsData) {
    await db.insert(schema.channels).values({
      id: ch.id,
      organizationId: ch.orgId,
      name: ch.name,
      slug: ch.slug,
      description: ch.description,
      topic: ch.topic,
      isPrivate: ch.isPrivate,
      createdBy: ch.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`  Created ${channelsData.length} channels\n`);

  // ============================================
  // 6. CREATE CHANNEL MEMBERS
  // ============================================
  console.log("Creating channel memberships...");

  let channelMemberCount = 0;

  // Helper to add members to channels for an org
  const addChannelMemberships = async (
    orgId: string,
    members: MemberSeed[],
    privateChannelMemberUserIds?: { [channelSlug: string]: string[] }
  ) => {
    const orgChannels = channelsData.filter(c => c.orgId === orgId);
    const memberUserIds = members.filter(m => !m.isGuest).map(m => m.userId); // Exclude guests from public channels
    const guestMembers = members.filter(m => m.isGuest);

    for (const channel of orgChannels) {
      if (channel.isPrivate) {
        // Add specific members to private channels
        const privateMembers = privateChannelMemberUserIds?.[channel.slug] || [channel.createdBy];
        for (const userId of privateMembers) {
          await db.insert(schema.channelMembers).values({
            id: crypto.randomUUID(),
            channelId: channel.id,
            userId: userId,
            role: userId === channel.createdBy ? "admin" : "member",
            joinedAt: now,
          });
          channelMemberCount++;
        }
      } else {
        // Add all non-guest members to public channels
        for (const userId of memberUserIds) {
          await db.insert(schema.channelMembers).values({
            id: crypto.randomUUID(),
            channelId: channel.id,
            userId: userId,
            role: userId === channel.createdBy ? "admin" : "member",
            joinedAt: now,
          });
          channelMemberCount++;
        }
      }
    }

    // Handle guest channel access - grant specific channels
    for (const guestMember of guestMembers) {
      const guestMemberId = memberIdMap.get(`${orgId}:${guestMember.userId}`);
      if (!guestMemberId) continue;

      // Grant guest access to general and help channels (if exists)
      const guestChannels = orgChannels.filter(c =>
        !c.isPrivate && (c.slug === "general" || c.slug === "help" || c.slug === "introductions")
      );

      for (const channel of guestChannels) {
        // Add as channel member
        await db.insert(schema.channelMembers).values({
          id: crypto.randomUUID(),
          channelId: channel.id,
          userId: guestMember.userId,
          role: "member",
          joinedAt: now,
        });
        channelMemberCount++;

        // Also add to guest_channel_access for channel-scoped permissions
        await db.insert(schema.guestChannelAccess).values({
          memberId: guestMemberId,
          channelId: channel.id,
          grantedAt: now,
        });
      }
    }
  };

  // Acme Corp memberships
  await addChannelMemberships(orgsData[0].id, acmeMembers, {
    leadership: [usersData[0].id, usersData[1].id], // Alice and Bob
  });

  // Startup Labs memberships
  await addChannelMemberships(orgsData[1].id, startupMembers, {
    founders: [usersData[5].id, usersData[6].id], // Frank and Grace
  });

  // Open Community memberships (with guest)
  await addChannelMemberships(orgsData[2].id, openCommunityMembers, {
    moderators: [usersData[2].id, usersData[3].id], // Carol and David
  });

  // Enterprise Solutions memberships
  await addChannelMemberships(orgsData[3].id, enterpriseMembers, {
    executive: [usersData[1].id, usersData[0].id], // Bob and Alice
  });

  console.log(`  Created ${channelMemberCount} channel memberships\n`);

  // ============================================
  // 7. CREATE CONVERSATIONS (DMs)
  // ============================================
  console.log("Creating conversations (DMs)...");

  interface ConversationSeed {
    id: string;
    orgId: string;
    isGroup: boolean;
    name?: string;
    createdBy: string;
    participants: string[];
  }

  const conversationsData: ConversationSeed[] = [
    // Acme Corp DMs (invite_only)
    { id: crypto.randomUUID(), orgId: orgsData[0].id, isGroup: false, createdBy: usersData[0].id, participants: [usersData[0].id, usersData[1].id] },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, isGroup: false, createdBy: usersData[2].id, participants: [usersData[2].id, usersData[0].id] },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, isGroup: false, createdBy: usersData[1].id, participants: [usersData[1].id, usersData[3].id] },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, isGroup: true, name: "Project Alpha Team", createdBy: usersData[0].id, participants: [usersData[0].id, usersData[1].id, usersData[3].id, usersData[4].id] },
    // Startup Labs DMs (request)
    { id: crypto.randomUUID(), orgId: orgsData[1].id, isGroup: false, createdBy: usersData[5].id, participants: [usersData[5].id, usersData[6].id] },
    { id: crypto.randomUUID(), orgId: orgsData[1].id, isGroup: false, createdBy: usersData[7].id, participants: [usersData[7].id, usersData[5].id] },
    { id: crypto.randomUUID(), orgId: orgsData[1].id, isGroup: true, name: "Startup Core Team", createdBy: usersData[5].id, participants: [usersData[5].id, usersData[6].id, usersData[7].id] },
    // Open Community DMs (open)
    { id: crypto.randomUUID(), orgId: orgsData[2].id, isGroup: false, createdBy: usersData[2].id, participants: [usersData[2].id, usersData[3].id] },
    { id: crypto.randomUUID(), orgId: orgsData[2].id, isGroup: false, createdBy: usersData[4].id, participants: [usersData[4].id, usersData[5].id] },
    { id: crypto.randomUUID(), orgId: orgsData[2].id, isGroup: true, name: "Community Moderators", createdBy: usersData[2].id, participants: [usersData[2].id, usersData[3].id, usersData[4].id] },
    // Enterprise Solutions DMs (request)
    { id: crypto.randomUUID(), orgId: orgsData[3].id, isGroup: false, createdBy: usersData[1].id, participants: [usersData[1].id, usersData[0].id] },
    { id: crypto.randomUUID(), orgId: orgsData[3].id, isGroup: false, createdBy: usersData[7].id, participants: [usersData[7].id, usersData[3].id] },
    { id: crypto.randomUUID(), orgId: orgsData[3].id, isGroup: true, name: "Enterprise Strategy", createdBy: usersData[1].id, participants: [usersData[1].id, usersData[0].id, usersData[7].id, usersData[3].id] },
  ];

  for (const conv of conversationsData) {
    await db.insert(schema.conversations).values({
      id: conv.id,
      organizationId: conv.orgId,
      isGroup: conv.isGroup,
      name: conv.name,
      createdBy: conv.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // Add participants
    for (const userId of conv.participants) {
      await db.insert(schema.conversationParticipants).values({
        id: crypto.randomUUID(),
        conversationId: conv.id,
        userId: userId,
        joinedAt: now,
      });
    }
  }
  console.log(`  Created ${conversationsData.length} conversations\n`);

  // ============================================
  // 8. CREATE MESSAGES
  // ============================================
  console.log("Creating messages...");

  // Helper to create dates in the past
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

  interface MessageSeed {
    id: string;
    content: string;
    authorId: string;
    channelId?: string;
    conversationId?: string;
    parentId?: string;
    sequence: number;
    createdAt: Date;
  }

  const messagesData: MessageSeed[] = [];
  let globalSeq = 0;

  // Get channel IDs
  const generalChannel = channelsData.find(c => c.slug === "general" && c.orgId === orgsData[0].id)!;
  const engineeringChannel = channelsData.find(c => c.slug === "engineering" && c.orgId === orgsData[0].id)!;
  const randomChannel = channelsData.find(c => c.slug === "random" && c.orgId === orgsData[0].id)!;
  const productChannel = channelsData.find(c => c.slug === "product" && c.orgId === orgsData[0].id)!;
  const designChannel = channelsData.find(c => c.slug === "design" && c.orgId === orgsData[0].id)!;

  // General channel messages
  const generalMessages: Omit<MessageSeed, 'id' | 'sequence'>[] = [
    { content: "Hey everyone! Welcome to Acme Corp's new communication platform!", authorId: usersData[0].id, channelId: generalChannel.id, createdAt: hoursAgo(48) },
    { content: "Thanks Alice! Excited to try this out.", authorId: usersData[1].id, channelId: generalChannel.id, createdAt: hoursAgo(47) },
    { content: "Looks great! Much better than our old setup.", authorId: usersData[2].id, channelId: generalChannel.id, createdAt: hoursAgo(46) },
    { content: "Quick reminder: All-hands meeting tomorrow at 10am PST!", authorId: usersData[0].id, channelId: generalChannel.id, createdAt: hoursAgo(24) },
    { content: "Will there be a recording for those who can't attend?", authorId: usersData[3].id, channelId: generalChannel.id, createdAt: hoursAgo(23) },
    { content: "Yes, we'll post it in #general afterwards.", authorId: usersData[0].id, channelId: generalChannel.id, createdAt: hoursAgo(22) },
    { content: "Perfect, thanks!", authorId: usersData[3].id, channelId: generalChannel.id, createdAt: hoursAgo(22) },
    { content: "Don't forget to submit your quarterly reports by Friday!", authorId: usersData[2].id, channelId: generalChannel.id, createdAt: hoursAgo(5) },
    { content: "Already submitted mine!", authorId: usersData[4].id, channelId: generalChannel.id, createdAt: hoursAgo(4) },
  ];

  for (const msg of generalMessages) {
    messagesData.push({ ...msg, id: crypto.randomUUID(), sequence: ++globalSeq });
  }

  // Engineering channel messages with a thread
  const engMessages: Omit<MessageSeed, 'id' | 'sequence'>[] = [
    { content: "Team, we need to discuss the API redesign for v2.0", authorId: usersData[0].id, channelId: engineeringChannel.id, createdAt: hoursAgo(36) },
    { content: "I've drafted some initial specs. Let me share the doc.", authorId: usersData[1].id, channelId: engineeringChannel.id, createdAt: hoursAgo(35) },
    { content: "Here's the RFC: https://docs.example.com/api-v2-rfc", authorId: usersData[1].id, channelId: engineeringChannel.id, createdAt: hoursAgo(35) },
    { content: "Looks comprehensive! A few questions about the authentication flow.", authorId: usersData[3].id, channelId: engineeringChannel.id, createdAt: hoursAgo(34) },
  ];

  const engMsgIds: string[] = [];
  for (const msg of engMessages) {
    const id = crypto.randomUUID();
    engMsgIds.push(id);
    messagesData.push({ ...msg, id, sequence: ++globalSeq });
  }

  // Thread on the RFC message
  const rfcThreadMessages: Omit<MessageSeed, 'id' | 'sequence'>[] = [
    { content: "I think we should use JWT for the new auth system", authorId: usersData[3].id, channelId: engineeringChannel.id, parentId: engMsgIds[2], createdAt: hoursAgo(33) },
    { content: "Agreed. We should also add refresh token rotation.", authorId: usersData[1].id, channelId: engineeringChannel.id, parentId: engMsgIds[2], createdAt: hoursAgo(32) },
    { content: "What about OAuth2 support for third-party integrations?", authorId: usersData[0].id, channelId: engineeringChannel.id, parentId: engMsgIds[2], createdAt: hoursAgo(31) },
    { content: "Good point. I'll add a section on OAuth2 scopes.", authorId: usersData[1].id, channelId: engineeringChannel.id, parentId: engMsgIds[2], createdAt: hoursAgo(30) },
    { content: "Let's also consider rate limiting per client.", authorId: usersData[3].id, channelId: engineeringChannel.id, parentId: engMsgIds[2], createdAt: hoursAgo(29) },
  ];

  for (const msg of rfcThreadMessages) {
    messagesData.push({ ...msg, id: crypto.randomUUID(), sequence: ++globalSeq });
  }

  // More engineering messages
  const moreEngMessages: Omit<MessageSeed, 'id' | 'sequence'>[] = [
    { content: "CI pipeline is now 40% faster after the caching improvements!", authorId: usersData[3].id, channelId: engineeringChannel.id, createdAt: hoursAgo(12) },
    { content: "Nice work David! That's a huge improvement.", authorId: usersData[0].id, channelId: engineeringChannel.id, createdAt: hoursAgo(11) },
    { content: "The frontend build times are still slow. Looking into it.", authorId: usersData[1].id, channelId: engineeringChannel.id, createdAt: hoursAgo(8) },
    { content: "Try enabling SWC instead of Babel. Made a big difference for us.", authorId: usersData[3].id, channelId: engineeringChannel.id, createdAt: hoursAgo(7) },
    { content: "Just deployed the hotfix to production. All looking good.", authorId: usersData[1].id, channelId: engineeringChannel.id, createdAt: hoursAgo(2) },
  ];

  for (const msg of moreEngMessages) {
    messagesData.push({ ...msg, id: crypto.randomUUID(), sequence: ++globalSeq });
  }

  // Random channel messages
  const randomMessages: Omit<MessageSeed, 'id' | 'sequence'>[] = [
    { content: "Anyone up for lunch at the new Thai place?", authorId: usersData[1].id, channelId: randomChannel.id, createdAt: hoursAgo(28) },
    { content: "I'm in! What time?", authorId: usersData[4].id, channelId: randomChannel.id, createdAt: hoursAgo(27) },
    { content: "12:30 works for me", authorId: usersData[1].id, channelId: randomChannel.id, createdAt: hoursAgo(27) },
    { content: "See you there!", authorId: usersData[2].id, channelId: randomChannel.id, createdAt: hoursAgo(26) },
    { content: "Has anyone seen the new sci-fi movie? No spoilers please!", authorId: usersData[3].id, channelId: randomChannel.id, createdAt: hoursAgo(10) },
    { content: "Yes! It was amazing. You should definitely watch it.", authorId: usersData[4].id, channelId: randomChannel.id, createdAt: hoursAgo(9) },
    { content: "Friday fun fact: The average cloud weighs 1.1 million pounds!", authorId: usersData[2].id, channelId: randomChannel.id, createdAt: hoursAgo(3) },
    { content: "That's wild! Where do you find these facts?", authorId: usersData[0].id, channelId: randomChannel.id, createdAt: hoursAgo(2) },
  ];

  for (const msg of randomMessages) {
    messagesData.push({ ...msg, id: crypto.randomUUID(), sequence: ++globalSeq });
  }

  // Product channel messages
  const productMessages: Omit<MessageSeed, 'id' | 'sequence'>[] = [
    { content: "Sprint planning is tomorrow at 2pm. Please have your tickets ready.", authorId: usersData[2].id, channelId: productChannel.id, createdAt: hoursAgo(20) },
    { content: "I've prioritized the backlog. Here are the top 5 items for next sprint.", authorId: usersData[2].id, channelId: productChannel.id, createdAt: hoursAgo(19) },
    { content: "1. User authentication improvements\n2. Dashboard redesign\n3. Export functionality\n4. Performance optimizations\n5. Bug fixes from customer feedback", authorId: usersData[2].id, channelId: productChannel.id, createdAt: hoursAgo(19) },
    { content: "Sounds good. I'll make sure engineering is aligned.", authorId: usersData[0].id, channelId: productChannel.id, createdAt: hoursAgo(18) },
    { content: "Customer feedback summary from last week is ready for review.", authorId: usersData[2].id, channelId: productChannel.id, createdAt: hoursAgo(6) },
  ];

  for (const msg of productMessages) {
    messagesData.push({ ...msg, id: crypto.randomUUID(), sequence: ++globalSeq });
  }

  // Design channel messages
  const designMessages: Omit<MessageSeed, 'id' | 'sequence'>[] = [
    { content: "New mockups for the settings page are ready for review!", authorId: usersData[4].id, channelId: designChannel.id, createdAt: hoursAgo(15) },
    { content: "These look great Emma! Love the new color scheme.", authorId: usersData[2].id, channelId: designChannel.id, createdAt: hoursAgo(14) },
    { content: "Thanks! I tried to match our new brand guidelines.", authorId: usersData[4].id, channelId: designChannel.id, createdAt: hoursAgo(14) },
    { content: "Can we get a dark mode version as well?", authorId: usersData[1].id, channelId: designChannel.id, createdAt: hoursAgo(13) },
    { content: "Already working on it! Should have it ready by EOD.", authorId: usersData[4].id, channelId: designChannel.id, createdAt: hoursAgo(13) },
  ];

  for (const msg of designMessages) {
    messagesData.push({ ...msg, id: crypto.randomUUID(), sequence: ++globalSeq });
  }

  // DM messages
  const dm1 = conversationsData[0]; // Alice <-> Bob
  const dm1Messages: Omit<MessageSeed, 'id' | 'sequence'>[] = [
    { content: "Hey Bob, do you have a minute to discuss the deployment?", authorId: usersData[0].id, conversationId: dm1.id, createdAt: hoursAgo(16) },
    { content: "Sure, what's up?", authorId: usersData[1].id, conversationId: dm1.id, createdAt: hoursAgo(16) },
    { content: "I'm thinking we should add a staging environment before production.", authorId: usersData[0].id, conversationId: dm1.id, createdAt: hoursAgo(15) },
    { content: "That makes sense. We've had too many close calls lately.", authorId: usersData[1].id, conversationId: dm1.id, createdAt: hoursAgo(15) },
    { content: "Exactly. Can you draft a proposal for the infrastructure?", authorId: usersData[0].id, conversationId: dm1.id, createdAt: hoursAgo(14) },
    { content: "Will do. I'll have something by tomorrow.", authorId: usersData[1].id, conversationId: dm1.id, createdAt: hoursAgo(14) },
    { content: "Perfect, thanks!", authorId: usersData[0].id, conversationId: dm1.id, createdAt: hoursAgo(14) },
  ];

  for (const msg of dm1Messages) {
    messagesData.push({ ...msg, id: crypto.randomUUID(), sequence: ++globalSeq });
  }

  // Group DM messages (Project Alpha Team)
  const groupDm = conversationsData[3];
  const groupDmMessages: Omit<MessageSeed, 'id' | 'sequence'>[] = [
    { content: "Hey team, quick sync on Project Alpha progress?", authorId: usersData[0].id, conversationId: groupDm.id, createdAt: hoursAgo(8) },
    { content: "Backend API is 80% complete. Should be done by Wednesday.", authorId: usersData[1].id, conversationId: groupDm.id, createdAt: hoursAgo(7) },
    { content: "Infrastructure is ready. Just waiting on the final specs.", authorId: usersData[3].id, conversationId: groupDm.id, createdAt: hoursAgo(7) },
    { content: "Design handoff is tomorrow. I'll share the Figma link.", authorId: usersData[4].id, conversationId: groupDm.id, createdAt: hoursAgo(6) },
    { content: "Great progress everyone! Let's aim for a demo on Friday.", authorId: usersData[0].id, conversationId: groupDm.id, createdAt: hoursAgo(6) },
  ];

  for (const msg of groupDmMessages) {
    messagesData.push({ ...msg, id: crypto.randomUUID(), sequence: ++globalSeq });
  }

  // Insert all messages and track reply counts
  const replyCountMap = new Map<string, number>();

  for (const msg of messagesData) {
    await db.insert(schema.messages).values({
      id: msg.id,
      content: msg.content,
      authorId: msg.authorId,
      channelId: msg.channelId,
      conversationId: msg.conversationId,
      parentId: msg.parentId,
      sequence: msg.sequence,
      replyCount: 0,
      createdAt: msg.createdAt,
      updatedAt: msg.createdAt,
    });

    // Track replies
    if (msg.parentId) {
      replyCountMap.set(msg.parentId, (replyCountMap.get(msg.parentId) || 0) + 1);
    }
  }

  // Update reply counts for parent messages
  for (const [parentId, count] of replyCountMap) {
    await db.update(schema.messages)
      .set({ replyCount: count })
      .where(eq(schema.messages.id, parentId));
  }

  console.log(`  Created ${messagesData.length} messages (${replyCountMap.size} threads)\n`);

  // ============================================
  // 9. CREATE REACTIONS
  // ============================================
  console.log("Creating reactions...");

  interface ReactionSeed {
    messageId: string;
    userId: string;
    emoji: string;
  }

  const reactionsData: ReactionSeed[] = [
    // Reactions on general channel messages
    { messageId: messagesData[0].id, userId: usersData[1].id, emoji: "👋" },
    { messageId: messagesData[0].id, userId: usersData[2].id, emoji: "👋" },
    { messageId: messagesData[0].id, userId: usersData[3].id, emoji: "🎉" },
    { messageId: messagesData[1].id, userId: usersData[0].id, emoji: "❤️" },
    { messageId: messagesData[3].id, userId: usersData[1].id, emoji: "👍" },
    { messageId: messagesData[3].id, userId: usersData[2].id, emoji: "📅" },
    { messageId: messagesData[8].id, userId: usersData[0].id, emoji: "🚀" },
    { messageId: messagesData[8].id, userId: usersData[1].id, emoji: "⭐" },
    // Reactions on engineering messages
    { messageId: messagesData[11].id, userId: usersData[0].id, emoji: "👀" },
    { messageId: messagesData[11].id, userId: usersData[3].id, emoji: "📝" },
    // CI improvement message
    { messageId: messagesData[18].id, userId: usersData[0].id, emoji: "🎉" },
    { messageId: messagesData[18].id, userId: usersData[1].id, emoji: "🚀" },
    { messageId: messagesData[18].id, userId: usersData[4].id, emoji: "💪" },
  ];

  for (const reaction of reactionsData) {
    await db.insert(schema.reactions).values({
      id: crypto.randomUUID(),
      messageId: reaction.messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
      createdAt: now,
    });
  }
  console.log(`  Created ${reactionsData.length} reactions\n`);

  // ============================================
  // 10. CREATE PINNED MESSAGES
  // ============================================
  console.log("Creating pinned messages...");

  const pinnedMessagesData = [
    // Pin the welcome message in general
    { messageId: messagesData[0].id, channelId: generalChannel.id, pinnedBy: usersData[0].id },
    // Pin the RFC link in engineering
    { messageId: messagesData[11].id, channelId: engineeringChannel.id, pinnedBy: usersData[1].id },
    // Pin sprint priorities in product
    { messageId: messagesData.find(m => m.channelId === productChannel.id && m.content.includes("1. User authentication"))!.id, channelId: productChannel.id, pinnedBy: usersData[2].id },
  ];

  for (const pin of pinnedMessagesData) {
    await db.insert(schema.pinnedMessages).values({
      id: crypto.randomUUID(),
      messageId: pin.messageId,
      channelId: pin.channelId,
      pinnedBy: pin.pinnedBy,
      pinnedAt: now,
    });
  }
  console.log(`  Created ${pinnedMessagesData.length} pinned messages\n`);

  // ============================================
  // 11. CREATE THREAD PARTICIPANTS
  // ============================================
  console.log("Creating thread participants...");

  // The RFC thread participants
  const rfcParentId = engMsgIds[2];
  const threadParticipantsData = [
    { threadId: rfcParentId, userId: usersData[0].id },
    { threadId: rfcParentId, userId: usersData[1].id },
    { threadId: rfcParentId, userId: usersData[3].id },
  ];

  for (const tp of threadParticipantsData) {
    await db.insert(schema.threadParticipants).values({
      id: crypto.randomUUID(),
      threadId: tp.threadId,
      userId: tp.userId,
      lastReadAt: now,
      joinedAt: hoursAgo(33),
    });
  }
  console.log(`  Created ${threadParticipantsData.length} thread participants\n`);

  // ============================================
  // 12. CREATE NOTIFICATIONS
  // ============================================
  console.log("Creating notifications...");

  const notificationsData = [
    // Mention notifications
    { userId: usersData[0].id, type: "mention", messageId: messagesData[4].id, channelId: generalChannel.id, actorId: usersData[3].id, content: "Will there be a recording for those who can't attend?" },
    { userId: usersData[1].id, type: "thread_reply", messageId: messagesData[13].id, channelId: engineeringChannel.id, actorId: usersData[3].id, content: "I think we should use JWT for the new auth system" },
    { userId: usersData[0].id, type: "thread_reply", messageId: messagesData[15].id, channelId: engineeringChannel.id, actorId: usersData[1].id, content: "Good point. I'll add a section on OAuth2 scopes." },
    // Some read, some unread
    { userId: usersData[2].id, type: "channel", messageId: messagesData[7].id, channelId: generalChannel.id, actorId: usersData[2].id, content: "Don't forget to submit your quarterly reports by Friday!", readAt: now },
  ];

  for (const notif of notificationsData) {
    await db.insert(schema.notifications).values({
      id: crypto.randomUUID(),
      userId: notif.userId,
      type: notif.type,
      messageId: notif.messageId,
      channelId: notif.channelId,
      actorId: notif.actorId,
      content: notif.content,
      readAt: (notif as { readAt?: Date }).readAt || null,
      createdAt: now,
    });
  }
  console.log(`  Created ${notificationsData.length} notifications\n`);

  // ============================================
  // 13. CREATE CHANNEL READ STATES
  // ============================================
  console.log("Creating channel read states...");

  let readStateCount = 0;

  // Get all workspace member lists
  const workspaceMemberMap: { [orgId: string]: MemberSeed[] } = {
    [orgsData[0].id]: acmeMembers,
    [orgsData[1].id]: startupMembers,
    [orgsData[2].id]: openCommunityMembers,
    [orgsData[3].id]: enterpriseMembers,
  };

  const privateChannelMembers: { [key: string]: string[] } = {
    [`${orgsData[0].id}:leadership`]: [usersData[0].id, usersData[1].id],
    [`${orgsData[1].id}:founders`]: [usersData[5].id, usersData[6].id],
    [`${orgsData[2].id}:moderators`]: [usersData[2].id, usersData[3].id],
    [`${orgsData[3].id}:executive`]: [usersData[1].id, usersData[0].id],
  };

  // Give each user a read state for channels they're in
  for (const channel of channelsData) {
    const orgMembers = workspaceMemberMap[channel.orgId] || [];
    const memberUserIds = channel.isPrivate
      ? (privateChannelMembers[`${channel.orgId}:${channel.slug}`] || [channel.createdBy])
      : orgMembers.filter(m => !m.isGuest).map(m => m.userId);

    for (const userId of memberUserIds) {
      // Some users are caught up, some have unread messages
      const lastReadSeq = Math.random() > 0.3 ? globalSeq : Math.floor(globalSeq * 0.8);

      await db.insert(schema.channelReadState).values({
        id: crypto.randomUUID(),
        userId: userId,
        channelId: channel.id,
        lastReadSequence: lastReadSeq,
        updatedAt: now,
      });
      readStateCount++;
    }
  }

  // Read states for DMs
  for (const conv of conversationsData) {
    for (const userId of conv.participants) {
      await db.insert(schema.channelReadState).values({
        id: crypto.randomUUID(),
        userId: userId,
        conversationId: conv.id,
        lastReadSequence: globalSeq,
        updatedAt: now,
      });
      readStateCount++;
    }
  }

  console.log(`  Created ${readStateCount} read states\n`);

  // ============================================
  // 14. CREATE CHANNEL NOTIFICATION SETTINGS
  // ============================================
  console.log("Creating channel notification settings...");

  const notifSettingsData = [
    // Bob has random channel muted
    { userId: usersData[1].id, channelId: randomChannel.id, mode: "muted" },
    // Carol only wants mentions in engineering
    { userId: usersData[2].id, channelId: engineeringChannel.id, mode: "mentions" },
    // David has product channel muted
    { userId: usersData[3].id, channelId: productChannel.id, mode: "muted" },
  ];

  for (const setting of notifSettingsData) {
    await db.insert(schema.channelNotificationSettings).values({
      id: crypto.randomUUID(),
      userId: setting.userId,
      channelId: setting.channelId,
      mode: setting.mode,
      updatedAt: now,
    });
  }
  console.log(`  Created ${notifSettingsData.length} notification settings\n`);

  // ============================================
  // 15. CREATE PENDING INVITATION
  // ============================================
  console.log("Creating invitations...");

  // Create invitations for each workspace
  for (const org of orgsData) {
    await db.insert(schema.invitations).values({
      id: genId(),
      email: `invited-${org.slug}@example.com`,
      organizationId: org.id,
      inviterId: org.joinPolicy === "invite_only" ? usersData[0].id :
                 org.joinPolicy === "request" ? usersData[5].id : usersData[2].id,
      role: "member",
      status: "pending",
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
    });
  }
  console.log(`  Created ${orgsData.length} pending invitations\n`);

  // ============================================
  // 16. CREATE WORKSPACE JOIN REQUESTS
  // ============================================
  console.log("Creating workspace join requests...");

  // Create pending join requests for workspaces with "request" policy
  const requestWorkspaces = orgsData.filter(org => org.joinPolicy === "request");
  let joinRequestCount = 0;

  for (const ws of requestWorkspaces) {
    // Create a pending request from a user not in the workspace
    const nonMemberUser = usersData.find(u =>
      !workspaceMemberMap[ws.id]?.some(m => m.userId === u.id)
    );

    if (nonMemberUser) {
      await db.insert(schema.workspaceJoinRequests).values({
        userId: nonMemberUser.id,
        organizationId: ws.id,
        message: `I'd love to join ${ws.name}! I'm interested in collaborating with the team.`,
        status: "pending",
        createdAt: hoursAgo(24),
      });
      joinRequestCount++;
    }

    // Create an approved request (historical)
    const approvedMember = workspaceMemberMap[ws.id]?.find(m => m.role === "member");
    const adminUser = workspaceMemberMap[ws.id]?.find(m => m.role === "admin" || m.role === "owner");

    if (approvedMember && adminUser) {
      await db.insert(schema.workspaceJoinRequests).values({
        userId: approvedMember.userId,
        organizationId: ws.id,
        message: "Excited to be part of this workspace!",
        status: "approved",
        createdAt: hoursAgo(72),
        reviewedAt: hoursAgo(48),
        reviewedBy: adminUser.userId,
      });
      joinRequestCount++;
    }
  }
  console.log(`  Created ${joinRequestCount} workspace join requests\n`);

  // ============================================
  // 17. CREATE GUEST INVITES
  // ============================================
  console.log("Creating guest invites...");

  // Create guest invite links for each workspace
  let guestInviteCount = 0;

  // Get workspace owner info from member data
  const getWorkspaceOwner = (orgId: string): string => {
    const members = workspaceMemberMap[orgId];
    const owner = members?.find(m => m.role === "owner");
    return owner?.userId || usersData[0].id;
  };

  for (const org of orgsData) {
    const wsChannels = channelsData.filter(c => c.orgId === org.id && !c.isPrivate);
    const generalChannel = wsChannels.find(c => c.slug === "general");

    if (generalChannel) {
      // Active guest invite
      await db.insert(schema.guestInvites).values({
        organizationId: org.id,
        token: `guest-${org.slug}-${nanoid(12)}`,
        createdBy: getWorkspaceOwner(org.id),
        expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
        channelIds: JSON.stringify([generalChannel.id]),
        createdAt: hoursAgo(48),
      });
      guestInviteCount++;

      // Used guest invite (historical) for workspace with guest
      const wsMembers = workspaceMemberMap[org.id];
      const guestMember = wsMembers?.find(m => m.isGuest);
      if (guestMember) {
        await db.insert(schema.guestInvites).values({
          organizationId: org.id,
          token: `used-guest-${org.slug}-${nanoid(12)}`,
          createdBy: getWorkspaceOwner(org.id),
          channelIds: JSON.stringify([generalChannel.id]),
          usedBy: guestMember.userId,
          usedAt: hoursAgo(24),
          createdAt: hoursAgo(72),
        });
        guestInviteCount++;
      }
    }
  }
  console.log(`  Created ${guestInviteCount} guest invites\n`);

  // ============================================
  // 18. CREATE SIDEBAR PREFERENCES
  // ============================================
  console.log("Creating sidebar preferences...");

  let sidebarPrefCount = 0;
  const defaultSectionOrder = ['threads', 'search', 'notes', 'scheduled', 'reminders', 'saved'];

  // Create sidebar preferences for some users in each workspace
  for (const org of orgsData) {
    const wsMembers = workspaceMemberMap[org.id] || [];
    // Give first 3 non-guest members customized sidebar preferences
    const membersWithPrefs = wsMembers.filter(m => !m.isGuest).slice(0, 3);

    for (let i = 0; i < membersWithPrefs.length; i++) {
      const member = membersWithPrefs[i];
      const wsConversations = conversationsData.filter(c =>
        c.orgId === org.id && c.participants.includes(member.userId)
      );

      // Create varied preferences for each user
      const preferences = {
        categoryOrder: [] as string[], // Would be populated with category IDs in real scenario
        dmOrder: wsConversations.map(c => c.id),
        sectionOrder: i === 0 ? defaultSectionOrder :
          i === 1 ? ['notes', 'threads', 'search', 'saved', 'scheduled', 'reminders'] :
            ['search', 'saved', 'threads', 'notes', 'scheduled', 'reminders'],
        hiddenSections: i === 2 ? ['scheduled'] : [],
        collapsedSections: i === 1 ? ['reminders'] : [],
        updatedAt: now.toISOString(),
      };

      await db.insert(schema.userSidebarPreferences).values({
        userId: member.userId,
        organizationId: org.id,
        preferences,
        createdAt: now,
        updatedAt: now,
      });
      sidebarPrefCount++;
    }
  }
  console.log(`  Created ${sidebarPrefCount} sidebar preferences\n`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("=".repeat(50));
  console.log("SEED COMPLETE!");
  console.log("=".repeat(50));
  console.log(`\nTest Accounts (password for all: '${TEST_PASSWORD}'):`);
  console.log("-".repeat(50));
  for (const u of usersData) {
    console.log(`  ${u.email.padEnd(25)} - ${u.name}`);
  }
  console.log("\nWorkspaces (with visibility policies):");
  console.log("-".repeat(50));
  for (const org of orgsData) {
    const policyLabel = org.joinPolicy === "invite_only" ? "Private" :
                        org.joinPolicy === "request" ? "Request Access" : "Open";
    console.log(`  ${org.slug.padEnd(25)} [${policyLabel.padEnd(14)}] - ${org.name}`);
  }
  console.log("\nVisibility Policies:");
  console.log("-".repeat(50));
  console.log("  Private (invite_only) - Hidden from browse, invitation only");
  console.log("  Request Access        - Visible in browse, requires admin approval");
  console.log("  Open                  - Visible in browse, instant join");
  console.log("\nTo login, visit: http://localhost/login");
  console.log("");
}

seed()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

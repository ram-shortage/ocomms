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
 */

import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as bcrypt from "bcryptjs";

// Helper to generate IDs like better-auth does
const genId = () => nanoid(24);

// Hash password like better-auth
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Test users data
const TEST_PASSWORD = "password123"; // All test users use this password

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

// Organization (workspace) data
interface OrgSeed {
  id: string;
  name: string;
  slug: string;
}

const orgsData: OrgSeed[] = [
  { id: genId(), name: "Acme Corp", slug: "acme-corp" },
  { id: genId(), name: "Startup Labs", slug: "startup-labs" },
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
    { userId: usersData[0].id, displayName: "Alice", title: "Engineering Lead", timezone: "America/New_York", status: "Working on the new API" },
    { userId: usersData[1].id, displayName: "Bob", title: "Senior Developer", timezone: "America/Los_Angeles", status: "In meetings until 3pm" },
    { userId: usersData[2].id, displayName: "Carol", title: "Product Manager", timezone: "America/Chicago", status: "Reviewing sprint planning" },
    { userId: usersData[3].id, displayName: "David", title: "DevOps Engineer", timezone: "Asia/Seoul", status: "Deploying to staging" },
    { userId: usersData[4].id, displayName: "Emma", title: "UX Designer", timezone: "Europe/London", status: "Design review at 2pm" },
    { userId: usersData[5].id, displayName: "Frank", title: "QA Engineer", timezone: "America/Denver", status: "Testing new features" },
    { userId: usersData[6].id, displayName: "Grace", title: "Frontend Developer", timezone: "Asia/Tokyo", status: "Working from home" },
    { userId: usersData[7].id, displayName: "Henry", title: "Backend Developer", timezone: "Europe/Berlin", status: "Code review time" },
  ];

  for (const profile of profilesData) {
    await db.insert(schema.profiles).values({
      id: crypto.randomUUID(),
      userId: profile.userId,
      displayName: profile.displayName,
      title: profile.title,
      timezone: profile.timezone,
      status: profile.status,
      createdAt: now,
      updatedAt: now,
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
      createdAt: now,
    });
  }
  console.log(`  Created ${orgsData.length} organizations\n`);

  // ============================================
  // 4. CREATE MEMBERS (org memberships)
  // ============================================
  console.log("Creating organization memberships...");

  // Acme Corp: Alice (owner), Bob, Carol, David, Emma (all members)
  const acmeMembers = [
    { orgId: orgsData[0].id, userId: usersData[0].id, role: "owner" },
    { orgId: orgsData[0].id, userId: usersData[1].id, role: "admin" },
    { orgId: orgsData[0].id, userId: usersData[2].id, role: "member" },
    { orgId: orgsData[0].id, userId: usersData[3].id, role: "member" },
    { orgId: orgsData[0].id, userId: usersData[4].id, role: "member" },
  ];

  // Startup Labs: Frank (owner), Grace, Henry
  const startupMembers = [
    { orgId: orgsData[1].id, userId: usersData[5].id, role: "owner" },
    { orgId: orgsData[1].id, userId: usersData[6].id, role: "admin" },
    { orgId: orgsData[1].id, userId: usersData[7].id, role: "member" },
    // Alice is also in Startup Labs
    { orgId: orgsData[1].id, userId: usersData[0].id, role: "member" },
  ];

  const allMembers = [...acmeMembers, ...startupMembers];

  for (const m of allMembers) {
    await db.insert(schema.members).values({
      id: genId(),
      organizationId: m.orgId,
      userId: m.userId,
      role: m.role,
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
    // Acme Corp channels
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "general", slug: "general", description: "Company-wide announcements and general discussion", topic: "Welcome to Acme Corp!", isPrivate: false, createdBy: usersData[0].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "engineering", slug: "engineering", description: "Engineering team discussions", topic: "Q1 Goals: Ship v2.0", isPrivate: false, createdBy: usersData[0].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "random", slug: "random", description: "Non-work banter and water cooler chat", isPrivate: false, createdBy: usersData[1].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "product", slug: "product", description: "Product planning and roadmap discussions", topic: "Roadmap review every Tuesday", isPrivate: false, createdBy: usersData[2].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "leadership", slug: "leadership", description: "Private channel for leadership team", isPrivate: true, createdBy: usersData[0].id },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, name: "design", slug: "design", description: "Design team collaboration", topic: "Design system v3 in progress", isPrivate: false, createdBy: usersData[4].id },
    // Startup Labs channels
    { id: crypto.randomUUID(), orgId: orgsData[1].id, name: "general", slug: "general", description: "General discussion for Startup Labs", topic: "Let's build something great!", isPrivate: false, createdBy: usersData[5].id },
    { id: crypto.randomUUID(), orgId: orgsData[1].id, name: "dev", slug: "dev", description: "Development discussions", isPrivate: false, createdBy: usersData[6].id },
    { id: crypto.randomUUID(), orgId: orgsData[1].id, name: "founders", slug: "founders", description: "Private founder discussions", isPrivate: true, createdBy: usersData[5].id },
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

  // Add all Acme members to public Acme channels
  const acmePublicChannels = channelsData.filter(c => c.orgId === orgsData[0].id && !c.isPrivate);
  const acmeUserIds = acmeMembers.map(m => m.userId);

  let channelMemberCount = 0;
  for (const channel of acmePublicChannels) {
    for (const userId of acmeUserIds) {
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

  // Add only Alice and Bob to leadership (private)
  const leadershipChannel = channelsData.find(c => c.slug === "leadership" && c.orgId === orgsData[0].id)!;
  for (const userId of [usersData[0].id, usersData[1].id]) {
    await db.insert(schema.channelMembers).values({
      id: crypto.randomUUID(),
      channelId: leadershipChannel.id,
      userId: userId,
      role: userId === usersData[0].id ? "admin" : "member",
      joinedAt: now,
    });
    channelMemberCount++;
  }

  // Add Startup Labs members to their channels
  const startupPublicChannels = channelsData.filter(c => c.orgId === orgsData[1].id && !c.isPrivate);
  const startupUserIds = startupMembers.map(m => m.userId);

  for (const channel of startupPublicChannels) {
    for (const userId of startupUserIds) {
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

  // Add Frank to founders (private)
  const foundersChannel = channelsData.find(c => c.slug === "founders")!;
  await db.insert(schema.channelMembers).values({
    id: crypto.randomUUID(),
    channelId: foundersChannel.id,
    userId: usersData[5].id,
    role: "admin",
    joinedAt: now,
  });
  channelMemberCount++;

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
    // Acme 1:1 DMs
    { id: crypto.randomUUID(), orgId: orgsData[0].id, isGroup: false, createdBy: usersData[0].id, participants: [usersData[0].id, usersData[1].id] },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, isGroup: false, createdBy: usersData[2].id, participants: [usersData[2].id, usersData[0].id] },
    { id: crypto.randomUUID(), orgId: orgsData[0].id, isGroup: false, createdBy: usersData[1].id, participants: [usersData[1].id, usersData[3].id] },
    // Acme group DM
    { id: crypto.randomUUID(), orgId: orgsData[0].id, isGroup: true, name: "Project Alpha Team", createdBy: usersData[0].id, participants: [usersData[0].id, usersData[1].id, usersData[3].id, usersData[4].id] },
    // Startup Labs 1:1 DM
    { id: crypto.randomUUID(), orgId: orgsData[1].id, isGroup: false, createdBy: usersData[5].id, participants: [usersData[5].id, usersData[6].id] },
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

  // Give each user a read state for channels they're in
  for (const channel of channelsData) {
    const memberUserIds = channel.isPrivate
      ? (channel.slug === "leadership" ? [usersData[0].id, usersData[1].id] : [usersData[5].id])
      : (channel.orgId === orgsData[0].id ? acmeUserIds : startupUserIds);

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

  await db.insert(schema.invitations).values({
    id: genId(),
    email: "newuser@example.com",
    organizationId: orgsData[0].id,
    inviterId: usersData[0].id,
    role: "member",
    status: "pending",
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    createdAt: now,
  });
  console.log(`  Created 1 pending invitation\n`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("=".repeat(50));
  console.log("SEED COMPLETE!");
  console.log("=".repeat(50));
  console.log("\nTest Accounts (password for all: 'password123'):");
  console.log("-".repeat(50));
  for (const u of usersData) {
    console.log(`  ${u.email.padEnd(25)} - ${u.name}`);
  }
  console.log("\nWorkspaces:");
  console.log("-".repeat(50));
  for (const org of orgsData) {
    console.log(`  ${org.slug.padEnd(20)} - ${org.name}`);
  }
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

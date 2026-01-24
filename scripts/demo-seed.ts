/**
 * Demo Seed Script for OComms
 *
 * Creates comprehensive demo data at scale to showcase all features:
 * - 50+ users with profiles and statuses
 * - 4 workspaces with channel categories
 * - 70+ channels across workspaces
 * - Direct messages (1:1 and group)
 * - 5,000+ messages spread across 3 months
 * - Rich content with links, mentions, code blocks
 * - File attachments with programmatically generated images
 * - Custom emojis per workspace
 * - Channel and personal notes
 * - User groups for @mentions
 * - Reactions, threads, pins, bookmarks, reminders
 * - Read states and notification settings
 *
 * All dates are dynamically generated relative to script execution time,
 * covering the last 3 months to populate analytics dashboards.
 *
 * Usage: npx tsx scripts/demo-seed.ts
 */

import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "better-auth/crypto";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// ============================================
// PRODUCTION SAFETY CHECK
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

async function checkProductionSafety(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || "";
  const isProduction = PRODUCTION_INDICATORS.some((indicator) =>
    dbUrl.toLowerCase().includes(indicator.toLowerCase())
  );
  const allowProduction = process.env.ALLOW_PRODUCTION_SEED === "true";

  if (isProduction && !allowProduction) {
    console.log("\n" + "=".repeat(60));
    console.log("  ⚠️  PRODUCTION DATABASE DETECTED");
    console.log("=".repeat(60));
    console.log("\nYour DATABASE_URL appears to point to a production database.");
    console.log("Running this script will ADD demo data to your database.\n");
    console.log("If you're sure you want to proceed, either:");
    console.log("  1. Set ALLOW_PRODUCTION_SEED=true environment variable");
    console.log("  2. Type 'yes-seed-production' below to confirm\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question("Confirm production seed (type 'yes-seed-production'): ", resolve);
    });
    rl.close();

    if (answer !== "yes-seed-production") {
      console.log("\nAborted. No changes made.\n");
      process.exit(0);
    }

    console.log("\nProceeding with production seed...\n");
  } else if (isProduction && allowProduction) {
    console.log("\n⚠️  Production database detected - ALLOW_PRODUCTION_SEED=true set");
    console.log("Proceeding in 5 seconds... (Ctrl+C to abort)\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  userCount: 500,
  workspaceCount: 4,
  channelsPerWorkspace: 18,
  messagesTarget: 12000,
  threadsTarget: 400,
  dmsPerWorkspace: 20,
  groupDmsPerWorkspace: 8,
  customEmojisPerWorkspace: 12,
  attachmentsTarget: 200,
  timeRangeMonths: 3,
  testPassword: "TheOrder2026!!",
  // Workspace member distribution (must sum to <= userCount)
  // Varied sizes from small team to large organization
  workspaceSizes: [200, 150, 100, 50], // Large corp, medium startup, community, small team
};

// Helper to generate IDs like better-auth does
const genId = () => nanoid(24);

// ============================================
// DATE HELPERS - Dynamic relative to script run
// ============================================
const NOW = new Date();
const THREE_MONTHS_AGO = new Date(NOW);
THREE_MONTHS_AGO.setMonth(THREE_MONTHS_AGO.getMonth() - CONFIG.timeRangeMonths);

function randomDateInRange(start: Date = THREE_MONTHS_AGO, end: Date = NOW): Date {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return new Date(startTime + Math.random() * (endTime - startTime));
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

// Weighted random date - more recent dates are more likely (realistic activity pattern)
function weightedRecentDate(): Date {
  // Exponential distribution favoring recent dates
  const r = Math.random();
  const weight = Math.pow(r, 0.5); // Square root gives more weight to recent
  const rangeMs = NOW.getTime() - THREE_MONTHS_AGO.getTime();
  return new Date(THREE_MONTHS_AGO.getTime() + weight * rangeMs);
}

// Random time during work hours (8am-6pm) for more realistic patterns
function workHoursDate(baseDate: Date): Date {
  const hour = 8 + Math.floor(Math.random() * 10); // 8-17
  const minute = Math.floor(Math.random() * 60);
  const result = new Date(baseDate);
  result.setHours(hour, minute, Math.floor(Math.random() * 60), 0);
  return result;
}

// ============================================
// RANDOM DATA GENERATORS
// ============================================
const firstNames = [
  "Alice", "Bob", "Carol", "David", "Emma", "Frank", "Grace", "Henry",
  "Ivy", "Jack", "Kate", "Liam", "Mia", "Noah", "Olivia", "Paul",
  "Quinn", "Rachel", "Sam", "Tara", "Uma", "Victor", "Wendy", "Xander",
  "Yara", "Zach", "Anna", "Ben", "Clara", "Dylan", "Eva", "Felix",
  "Gina", "Hugo", "Iris", "James", "Kelly", "Leo", "Maya", "Nick",
  "Ola", "Peter", "Rita", "Steve", "Tina", "Uri", "Vera", "Will",
  "Xena", "Yuri", "Zoe", "Alex"
];

const lastNames = [
  "Chen", "Martinez", "Williams", "Kim", "Johnson", "Brown", "Lee", "Wilson",
  "Garcia", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "White",
  "Harris", "Thompson", "Robinson", "Clark", "Lewis", "Walker", "Hall", "Allen",
  "Young", "King", "Wright", "Scott", "Green", "Adams", "Baker", "Nelson",
  "Hill", "Ramirez", "Campbell", "Mitchell", "Roberts", "Carter", "Phillips", "Evans",
  "Turner", "Torres", "Parker", "Collins", "Edwards", "Stewart", "Morris", "Murphy",
  "Rivera", "Cook", "Rogers", "Morgan"
];

const jobTitles = [
  "Engineering Lead", "Senior Developer", "Product Manager", "DevOps Engineer",
  "UX Designer", "QA Engineer", "Frontend Developer", "Backend Developer",
  "Data Scientist", "Security Engineer", "Tech Lead", "Scrum Master",
  "Solutions Architect", "Mobile Developer", "Full Stack Developer", "SRE",
  "Engineering Manager", "Principal Engineer", "Staff Engineer", "Junior Developer",
  "Design Lead", "Content Strategist", "Growth Engineer", "Platform Engineer"
];

const statusTexts = [
  "In meetings until 3pm", "Working from home", "On vacation until Monday",
  "Focused on sprint work", "In deep work mode", "Taking a break",
  "Available for calls", "Lunch break", "Code review time", "Out sick",
  "At a conference", "Heads down coding", "In a workshop", "Pair programming"
];

const statusEmojis = ["💼", "🏠", "🌴", "🎯", "🧘", "☕", "📞", "🍔", "👀", "🤒", "🎤", "💻", "📚", "👥"];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ============================================
// MESSAGE CONTENT GENERATORS
// ============================================
const greetings = [
  "Hey everyone!", "Hi team!", "Hello!", "Good morning!", "Hey all!",
  "Hi there!", "Morning!", "Afternoon everyone!", "Hey folks!"
];

const genericMessages = [
  "That sounds great, let me know if you need any help with it.",
  "I'll take a look at this later today.",
  "Thanks for the update!",
  "Good point, I hadn't thought about that.",
  "Let me check and get back to you.",
  "Makes sense to me.",
  "I agree with this approach.",
  "Can we schedule a quick call to discuss?",
  "I'll add this to my todo list.",
  "Done! Let me know if you need anything else.",
  "Perfect, thanks!",
  "I'm working on this now.",
  "Just finished reviewing this.",
  "LGTM!",
  "Ship it!",
  "Nice work on this!",
  "Great progress!",
  "This looks good to go.",
  "Almost there!",
  "Just a few more tweaks needed.",
];

const technicalMessages = [
  "The API response times have improved by 40% after the optimization.",
  "I pushed a fix for the memory leak issue. Can someone review?",
  "The new caching layer is working great in staging.",
  "We need to update our dependencies before the next release.",
  "CI/CD pipeline is green after the latest changes.",
  "Found a bug in the authentication flow - creating a ticket now.",
  "The database migration completed successfully.",
  "Performance metrics look good after yesterday's deploy.",
  "I've added unit tests for the new feature.",
  "The load balancer configuration needs adjustment.",
  "Rolled back the last deployment due to errors.",
  "Monitoring shows normal traffic patterns today.",
  "The websocket connections are stable now.",
  "I've documented the API changes in the wiki.",
  "Let's do a code review session this afternoon.",
];

const productMessages = [
  "User feedback has been positive on the new feature.",
  "We should prioritize the mobile experience next sprint.",
  "The A/B test results are in - variant B performed 15% better.",
  "Customer interviews scheduled for next week.",
  "Roadmap review meeting is tomorrow at 2pm.",
  "Feature request from enterprise client: bulk export.",
  "We're on track for the Q2 release.",
  "Need input on the pricing page redesign.",
  "Support tickets are down 20% this month.",
  "The onboarding flow needs simplification.",
  "NPS score improved from last quarter.",
  "Competitor analysis document is ready for review.",
  "Beta testing starts next Monday.",
  "Customer success metrics look promising.",
];

const designMessages = [
  "New mockups are ready in Figma - check the latest frame.",
  "The color palette has been updated per brand guidelines.",
  "Design system components are documented and ready.",
  "User testing session scheduled for Thursday.",
  "Accessibility audit revealed a few issues to fix.",
  "Icon set has been expanded with 20 new icons.",
  "The dark mode design is complete.",
  "Motion design specs are in the handoff doc.",
  "Typography scale has been finalized.",
  "Component library is updated with the new variants.",
];

const randomMessages = [
  "Anyone up for lunch?",
  "Happy Friday everyone!",
  "That meeting could have been an email.",
  "Coffee machine on floor 3 is broken again.",
  "Who wants to join the book club?",
  "Great article on tech trends - sharing in thread.",
  "Team building event next month - any preferences?",
  "Working late tonight, anyone else around?",
  "Finally got that bug fixed!",
  "Three day weekend coming up!",
  "New season of that show dropped!",
  "Anyone watching the game tonight?",
  "Brought donuts to the office today.",
];

const linksAndResources = [
  "Check out this article: https://techblog.example.com/best-practices-2024",
  "Found a great tutorial: https://docs.example.com/getting-started",
  "Reference docs here: https://api.example.com/documentation",
  "Design inspiration: https://dribbble.example.com/shots/trending",
  "Relevant discussion: https://github.example.com/org/repo/discussions/123",
  "Meeting notes: https://notion.example.com/meeting-notes-q1",
  "Sprint board: https://jira.example.com/board/sprint-42",
  "Monitoring dashboard: https://grafana.example.com/d/main-dash",
  "Architecture diagram: https://miro.example.com/board/arch-v2",
  "Style guide: https://figma.example.com/file/design-system",
];

const codeBlocks = [
  "```typescript\nconst handleSubmit = async (data: FormData) => {\n  const response = await api.post('/submit', data);\n  return response.json();\n};\n```",
  "```bash\nnpm install && npm run build && npm run deploy\n```",
  "```sql\nSELECT users.*, COUNT(orders.id) as order_count\nFROM users\nLEFT JOIN orders ON users.id = orders.user_id\nGROUP BY users.id;\n```",
  "```json\n{\n  \"feature\": \"dark-mode\",\n  \"enabled\": true,\n  \"rollout\": 0.5\n}\n```",
  "```python\ndef process_data(items):\n    return [item.transform() for item in items if item.is_valid]\n```",
];

const threadStarters = [
  "Can we discuss the approach for",
  "I have some questions about",
  "Here's my proposal for",
  "Let's brainstorm ideas for",
  "Need feedback on",
  "Quick discussion about",
  "Thoughts on this approach for",
  "RFC:",
  "Proposal:",
  "Discussion:",
];

const threadReplies = [
  "I think we should consider...",
  "Good point! What about...",
  "Have we thought about the edge case where...",
  "I agree, and we could also...",
  "What's the timeline for this?",
  "Who's taking the lead on this?",
  "Let me look into this and report back.",
  "I have some concerns about...",
  "This looks solid to me.",
  "Can we get more context on...",
  "+1 on this approach",
  "I'd suggest we also consider...",
  "This aligns with what I was thinking.",
  "Let's sync up offline about this.",
];

function generateMessage(channelType: string, includeMention: boolean = false, users: Array<{id: string, name: string}> = []): string {
  let content = "";
  const rand = Math.random();

  if (rand < 0.05 && linksAndResources.length > 0) {
    content = pickRandom(linksAndResources);
  } else if (rand < 0.08 && codeBlocks.length > 0) {
    content = pickRandom(codeBlocks);
  } else if (channelType === "engineering") {
    content = pickRandom([...technicalMessages, ...genericMessages]);
  } else if (channelType === "product") {
    content = pickRandom([...productMessages, ...genericMessages]);
  } else if (channelType === "design") {
    content = pickRandom([...designMessages, ...genericMessages]);
  } else if (channelType === "random") {
    content = pickRandom([...randomMessages, ...genericMessages]);
  } else {
    content = pickRandom(genericMessages);
  }

  // Add mention occasionally
  if (includeMention && users.length > 0 && Math.random() < 0.15) {
    const mentionedUser = pickRandom(users);
    content = `@${mentionedUser.name.split(' ')[0].toLowerCase()} ${content}`;
  }

  return content;
}

function generateThreadContent(): { starter: string; replies: string[] } {
  const topic = pickRandom([
    "the new authentication system",
    "performance optimization",
    "the dashboard redesign",
    "API v2 migration",
    "the mobile app",
    "customer onboarding",
    "the pricing model",
    "infrastructure costs",
    "team processes",
    "documentation updates",
  ]);

  const starter = `${pickRandom(threadStarters)} ${topic}`;
  const replyCount = 2 + Math.floor(Math.random() * 6); // 2-7 replies
  const replies = pickRandomN(threadReplies, replyCount);

  return { starter, replies };
}

// ============================================
// PLACEHOLDER IMAGE GENERATOR
// ============================================
function generatePlaceholderPNG(width: number = 100, height: number = 100, color: string = "#4a90d9"): Buffer {
  // Generate a minimal valid PNG file
  // This creates a simple colored rectangle PNG

  // Convert hex color to RGB
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // Helper to create CRC32
  function crc32(data: Buffer): number {
    let crc = 0xFFFFFFFF;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // Create chunk
  function createChunk(type: string, data: Buffer): Buffer {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData), 0);

    return Buffer.concat([length, typeBuffer, data, crc]);
  }

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk (image data)
  // Create raw scanlines (filter byte + RGB data for each row)
  const rawData: number[] = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter type: none
    for (let x = 0; x < width; x++) {
      rawData.push(r, g, b);
    }
  }

  // Simple deflate (store blocks, no compression for simplicity)
  const deflateData: number[] = [];
  const raw = Buffer.from(rawData);

  // Zlib header
  deflateData.push(0x78, 0x01);

  // Store in 65535-byte blocks
  let offset = 0;
  while (offset < raw.length) {
    const remaining = raw.length - offset;
    const blockSize = Math.min(remaining, 65535);
    const isLast = offset + blockSize >= raw.length;

    deflateData.push(isLast ? 0x01 : 0x00);
    deflateData.push(blockSize & 0xFF);
    deflateData.push((blockSize >> 8) & 0xFF);
    deflateData.push((~blockSize) & 0xFF);
    deflateData.push(((~blockSize) >> 8) & 0xFF);

    for (let i = 0; i < blockSize; i++) {
      deflateData.push(raw[offset + i]);
    }
    offset += blockSize;
  }

  // Adler-32 checksum
  let a = 1, b1 = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]) % 65521;
    b1 = (b1 + a) % 65521;
  }
  const adler = (b1 << 16) | a;
  deflateData.push((adler >> 24) & 0xFF);
  deflateData.push((adler >> 16) & 0xFF);
  deflateData.push((adler >> 8) & 0xFF);
  deflateData.push(adler & 0xFF);

  const idat = createChunk('IDAT', Buffer.from(deflateData));

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// ============================================
// MAIN SEED FUNCTION
// ============================================
async function seed() {
  // Check for production database before proceeding
  await checkProductionSafety();

  console.log("=".repeat(60));
  console.log("  OCOMMS DEMO SEED - Large Scale Data Generation");
  console.log("=".repeat(60));
  console.log(`\nConfiguration:`);
  console.log(`  Users: ${CONFIG.userCount}`);
  console.log(`  Workspaces: ${CONFIG.workspaceCount}`);
  console.log(`  Channels/workspace: ~${CONFIG.channelsPerWorkspace}`);
  console.log(`  Target messages: ${CONFIG.messagesTarget}`);
  console.log(`  Time range: Last ${CONFIG.timeRangeMonths} months`);
  console.log(`  Date range: ${THREE_MONTHS_AGO.toISOString().split('T')[0]} to ${NOW.toISOString().split('T')[0]}`);
  console.log("");

  const hashedPassword = await hashPassword(CONFIG.testPassword);

  // ============================================
  // 1. CREATE USERS
  // ============================================
  console.log("1. Creating users...");

  interface UserData {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    jobTitle: string;
  }

  const users: UserData[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < CONFIG.userCount; i++) {
    let firstName: string, lastName: string, fullName: string;

    // Ensure unique names
    do {
      firstName = firstNames[i % firstNames.length];
      lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
      // Add suffix for duplicates
      if (i >= firstNames.length * lastNames.length) {
        lastName = `${lastName}${Math.floor(i / (firstNames.length * lastNames.length)) + 1}`;
      }
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));

    usedNames.add(fullName);

    const user: UserData = {
      id: genId(),
      name: fullName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      emailVerified: true,
      jobTitle: jobTitles[i % jobTitles.length],
    };
    users.push(user);

    const createdAt = randomDateInRange(daysAgo(90), daysAgo(30));

    await db.insert(schema.users).values({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt,
      updatedAt: createdAt,
    });

    await db.insert(schema.accounts).values({
      id: genId(),
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hashedPassword,
      createdAt,
      updatedAt: createdAt,
    });
  }
  console.log(`   Created ${users.length} users`);

  // ============================================
  // 2. CREATE PROFILES
  // ============================================
  console.log("2. Creating profiles...");

  for (const user of users) {
    await db.insert(schema.profiles).values({
      userId: user.id,
      displayName: user.name.split(' ')[0],
      bio: `${user.jobTitle} - ${pickRandom(statusTexts)}`,
    });
  }
  console.log(`   Created ${users.length} profiles`);

  // ============================================
  // 3. CREATE USER STATUSES (for some users)
  // ============================================
  console.log("3. Creating user statuses...");

  const usersWithStatus = pickRandomN(users, Math.floor(users.length * 0.4));
  for (const user of usersWithStatus) {
    const idx = Math.floor(Math.random() * statusTexts.length);
    await db.insert(schema.userStatuses).values({
      userId: user.id,
      emoji: statusEmojis[idx],
      text: statusTexts[idx],
      dndEnabled: Math.random() < 0.1,
      createdAt: NOW,
      updatedAt: NOW,
    });
  }
  console.log(`   Created ${usersWithStatus.length} user statuses`);

  // ============================================
  // 4. CREATE WORKSPACES (ORGANIZATIONS)
  // ============================================
  console.log("4. Creating workspaces...");

  interface WorkspaceData {
    id: string;
    name: string;
    slug: string;
    joinPolicy: "invite_only" | "request" | "open";
    description?: string;
    members: UserData[];
    owner: UserData;
  }

  const workspaceNames = [
    {
      name: "Acme Corporation",
      slug: "acme-corp",
      joinPolicy: "invite_only" as const,
      description: "Large enterprise workspace (~200 members) - private corporate communications"
    },
    {
      name: "TechStart Labs",
      slug: "techstart-labs",
      joinPolicy: "request" as const,
      description: "Growing startup hub (~150 members) - request access to join our innovation community"
    },
    {
      name: "Innovation Hub",
      slug: "innovation-hub",
      joinPolicy: "open" as const,
      description: "Open community workspace (~100 members) - everyone welcome to collaborate"
    },
    {
      name: "Digital Dynamics",
      slug: "digital-dynamics",
      joinPolicy: "request" as const,
      description: "Boutique agency (~50 members) - digital transformation specialists"
    },
  ];

  const workspaces: WorkspaceData[] = [];

  // Distribute users according to configured workspace sizes
  // Shuffle users first to get random distribution
  const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
  let userIndex = 0;

  for (let i = 0; i < CONFIG.workspaceCount; i++) {
    const wsData = workspaceNames[i];
    const targetSize = CONFIG.workspaceSizes[i] || 50; // Default to 50 if not specified
    const availableUsers = shuffledUsers.length - userIndex;
    const actualSize = Math.min(targetSize, availableUsers);

    // Get primary members for this workspace
    const wsMembers = shuffledUsers.slice(userIndex, userIndex + actualSize);
    userIndex += actualSize;

    // Add cross-workspace members (first 5 users are in all workspaces for testing)
    // This ensures Alice, Bob, Carol, David, Emma are always available for E2E tests
    const crossWorkspaceUsers = users.slice(0, 5).filter(u => !wsMembers.includes(u));
    wsMembers.push(...crossWorkspaceUsers);

    const workspace: WorkspaceData = {
      id: genId(),
      name: wsData.name,
      slug: wsData.slug,
      joinPolicy: wsData.joinPolicy,
      description: wsData.description,
      members: wsMembers,
      owner: wsMembers[0],
    };
    workspaces.push(workspace);

    await db.insert(schema.organizations).values({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      joinPolicy: workspace.joinPolicy,
      description: workspace.description,
      createdAt: daysAgo(90),
    });
  }
  console.log(`   Created ${workspaces.length} workspaces (sizes: ${workspaces.map(w => w.members.length).join(', ')})`);

  // ============================================
  // 5. CREATE WORKSPACE MEMBERSHIPS
  // ============================================
  console.log("5. Creating workspace memberships...");

  let membershipCount = 0;
  for (const ws of workspaces) {
    // Scale admins based on workspace size (roughly 1 admin per 20 members, min 2, max 10)
    const adminCount = Math.min(10, Math.max(2, Math.floor(ws.members.length / 20)));

    for (let i = 0; i < ws.members.length; i++) {
      const member = ws.members[i];
      const role = i === 0 ? "owner" : (i < adminCount ? "admin" : "member");

      await db.insert(schema.members).values({
        id: genId(),
        organizationId: ws.id,
        userId: member.id,
        role,
        createdAt: daysAgo(85 - Math.min(i, 80)), // Cap at 80 days ago
      });
      membershipCount++;
    }
  }
  console.log(`   Created ${membershipCount} memberships`);

  // ============================================
  // 6. CREATE CHANNEL CATEGORIES
  // ============================================
  console.log("6. Creating channel categories...");

  interface CategoryData {
    id: string;
    workspaceId: string;
    name: string;
    sortOrder: number;
  }

  const categoryTemplates = [
    "Engineering",
    "Product",
    "Design",
    "Operations",
    "Social",
  ];

  const categories: CategoryData[] = [];

  for (const ws of workspaces) {
    for (let i = 0; i < categoryTemplates.length; i++) {
      const category: CategoryData = {
        id: crypto.randomUUID(),
        workspaceId: ws.id,
        name: categoryTemplates[i],
        sortOrder: i,
      };
      categories.push(category);

      await db.insert(schema.channelCategories).values({
        id: category.id,
        organizationId: ws.id,
        name: category.name,
        sortOrder: category.sortOrder,
        createdBy: ws.owner.id,
        createdAt: daysAgo(88),
        updatedAt: daysAgo(88),
      });
    }
  }
  console.log(`   Created ${categories.length} categories`);

  // ============================================
  // 7. CREATE CHANNELS
  // ============================================
  console.log("7. Creating channels...");

  interface ChannelData {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    description: string;
    topic?: string;
    isPrivate: boolean;
    categoryId?: string;
    type: string;
    members: UserData[];
    createdBy: string;
  }

  const channelTemplates = [
    // Engineering
    { name: "general", desc: "Company-wide announcements", topic: "Welcome to the team!", type: "general", category: "Engineering", private: false },
    { name: "engineering", desc: "Engineering team discussions", topic: "Build great things", type: "engineering", category: "Engineering", private: false },
    { name: "backend", desc: "Backend development", topic: "APIs, databases, and servers", type: "engineering", category: "Engineering", private: false },
    { name: "frontend", desc: "Frontend development", topic: "UI/UX implementation", type: "engineering", category: "Engineering", private: false },
    { name: "devops", desc: "DevOps and infrastructure", topic: "CI/CD and cloud", type: "engineering", category: "Engineering", private: false },
    { name: "code-review", desc: "Code review requests", type: "engineering", category: "Engineering", private: false },
    // Product
    { name: "product", desc: "Product planning and roadmap", topic: "Building the future", type: "product", category: "Product", private: false },
    { name: "customer-feedback", desc: "Customer insights", type: "product", category: "Product", private: false },
    { name: "analytics", desc: "Data and metrics", type: "product", category: "Product", private: false },
    { name: "roadmap", desc: "Feature roadmap discussions", type: "product", category: "Product", private: true },
    // Design
    { name: "design", desc: "Design team collaboration", topic: "Pixels and prototypes", type: "design", category: "Design", private: false },
    { name: "ux-research", desc: "User experience research", type: "design", category: "Design", private: false },
    { name: "brand", desc: "Brand and marketing design", type: "design", category: "Design", private: false },
    // Operations
    { name: "hr", desc: "Human resources", type: "general", category: "Operations", private: true },
    { name: "finance", desc: "Finance and budgets", type: "general", category: "Operations", private: true },
    { name: "leadership", desc: "Leadership team", type: "general", category: "Operations", private: true },
    // Social
    { name: "random", desc: "Non-work banter", topic: "Have fun!", type: "random", category: "Social", private: false },
    { name: "introductions", desc: "Introduce yourself", type: "general", category: "Social", private: false },
  ];

  const allChannels: ChannelData[] = [];

  for (const ws of workspaces) {
    const wsCategories = categories.filter(c => c.workspaceId === ws.id);

    for (let i = 0; i < channelTemplates.length; i++) {
      const template = channelTemplates[i];
      const category = wsCategories.find(c => c.name === template.category);

      // Determine channel members
      let channelMembers: UserData[];
      if (template.private) {
        // Private channels have fewer members
        channelMembers = pickRandomN(ws.members, Math.floor(ws.members.length * 0.3));
        if (!channelMembers.includes(ws.owner)) {
          channelMembers.unshift(ws.owner);
        }
      } else {
        channelMembers = [...ws.members];
      }

      const channel: ChannelData = {
        id: crypto.randomUUID(),
        workspaceId: ws.id,
        name: template.name,
        slug: template.name,
        description: template.desc,
        topic: template.topic,
        isPrivate: template.private,
        categoryId: category?.id,
        type: template.type,
        members: channelMembers,
        createdBy: ws.owner.id,
      };
      allChannels.push(channel);

      await db.insert(schema.channels).values({
        id: channel.id,
        organizationId: ws.id,
        name: channel.name,
        slug: channel.slug,
        description: channel.description,
        topic: channel.topic,
        isPrivate: channel.isPrivate,
        categoryId: channel.categoryId,
        sortOrder: i,
        createdBy: channel.createdBy,
        createdAt: daysAgo(87),
        updatedAt: daysAgo(87),
      });
    }
  }
  console.log(`   Created ${allChannels.length} channels`);

  // ============================================
  // 8. CREATE CHANNEL MEMBERSHIPS
  // ============================================
  console.log("8. Creating channel memberships...");

  let channelMemberCount = 0;
  for (const channel of allChannels) {
    for (let i = 0; i < channel.members.length; i++) {
      const member = channel.members[i];
      await db.insert(schema.channelMembers).values({
        id: crypto.randomUUID(),
        channelId: channel.id,
        userId: member.id,
        role: i === 0 ? "admin" : "member",
        joinedAt: daysAgo(85 - Math.floor(Math.random() * 10)),
      });
      channelMemberCount++;
    }
  }
  console.log(`   Created ${channelMemberCount} channel memberships`);

  // ============================================
  // 9. CREATE USER GROUPS
  // ============================================
  console.log("9. Creating user groups...");

  interface UserGroupData {
    id: string;
    workspaceId: string;
    name: string;
    handle: string;
    members: UserData[];
  }

  const groupTemplates = [
    { name: "Engineering Team", handle: "engineering" },
    { name: "Design Team", handle: "design" },
    { name: "Product Team", handle: "product" },
    { name: "Leadership", handle: "leadership" },
  ];

  const userGroups: UserGroupData[] = [];

  for (const ws of workspaces) {
    for (const template of groupTemplates) {
      const groupMembers = pickRandomN(ws.members, Math.floor(ws.members.length * 0.25));

      const group: UserGroupData = {
        id: crypto.randomUUID(),
        workspaceId: ws.id,
        name: template.name,
        handle: template.handle,
        members: groupMembers,
      };
      userGroups.push(group);

      await db.insert(schema.userGroups).values({
        id: group.id,
        organizationId: ws.id,
        name: group.name,
        handle: group.handle,
        description: `${template.name} for ${ws.name}`,
        createdBy: ws.owner.id,
        createdAt: daysAgo(80),
        updatedAt: daysAgo(80),
      });

      for (const member of groupMembers) {
        await db.insert(schema.userGroupMembers).values({
          id: crypto.randomUUID(),
          groupId: group.id,
          userId: member.id,
          addedAt: daysAgo(80),
        });
      }
    }
  }
  console.log(`   Created ${userGroups.length} user groups`);

  // ============================================
  // 10. CREATE CONVERSATIONS (DMs)
  // ============================================
  console.log("10. Creating conversations (DMs)...");

  interface ConversationData {
    id: string;
    workspaceId: string;
    isGroup: boolean;
    name?: string;
    participants: UserData[];
    createdBy: string;
  }

  const conversations: ConversationData[] = [];

  for (const ws of workspaces) {
    // 1:1 DMs
    for (let i = 0; i < CONFIG.dmsPerWorkspace; i++) {
      const participants = pickRandomN(ws.members, 2);

      const conv: ConversationData = {
        id: crypto.randomUUID(),
        workspaceId: ws.id,
        isGroup: false,
        participants,
        createdBy: participants[0].id,
      };
      conversations.push(conv);

      await db.insert(schema.conversations).values({
        id: conv.id,
        organizationId: ws.id,
        isGroup: false,
        createdBy: conv.createdBy,
        createdAt: randomDateInRange(daysAgo(80), daysAgo(30)),
        updatedAt: NOW,
      });

      for (const p of participants) {
        await db.insert(schema.conversationParticipants).values({
          id: crypto.randomUUID(),
          conversationId: conv.id,
          userId: p.id,
          joinedAt: daysAgo(80),
        });
      }
    }

    // Group DMs
    const groupNames = ["Project Alpha", "Q1 Planning", "Hackathon Team", "Coffee Club"];
    for (let i = 0; i < CONFIG.groupDmsPerWorkspace; i++) {
      const participants = pickRandomN(ws.members, 3 + Math.floor(Math.random() * 3));

      const conv: ConversationData = {
        id: crypto.randomUUID(),
        workspaceId: ws.id,
        isGroup: true,
        name: groupNames[i % groupNames.length],
        participants,
        createdBy: participants[0].id,
      };
      conversations.push(conv);

      await db.insert(schema.conversations).values({
        id: conv.id,
        organizationId: ws.id,
        isGroup: true,
        name: conv.name,
        createdBy: conv.createdBy,
        createdAt: randomDateInRange(daysAgo(70), daysAgo(20)),
        updatedAt: NOW,
      });

      for (const p of participants) {
        await db.insert(schema.conversationParticipants).values({
          id: crypto.randomUUID(),
          conversationId: conv.id,
          userId: p.id,
          joinedAt: daysAgo(70),
        });
      }
    }
  }
  console.log(`   Created ${conversations.length} conversations`);

  // ============================================
  // 11. CREATE CUSTOM EMOJIS
  // ============================================
  console.log("11. Creating custom emojis...");

  const emojiDir = path.join(process.cwd(), "public", "uploads", "emoji");
  if (!fs.existsSync(emojiDir)) {
    fs.mkdirSync(emojiDir, { recursive: true });
  }

  const emojiNames = [
    "shipit", "lgtm", "nice", "fire", "rocket", "party", "thinking", "thumbsup",
    "celebrate", "coffee", "bug", "fix", "deploy", "merged", "approved", "wip"
  ];
  const emojiColors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5", "#9B59B6", "#3498DB"];

  interface CustomEmojiData {
    id: string;
    workspaceId: string;
    name: string;
    path: string;
  }

  const customEmojis: CustomEmojiData[] = [];

  for (const ws of workspaces) {
    const wsEmojis = pickRandomN(emojiNames, CONFIG.customEmojisPerWorkspace);

    for (const emojiName of wsEmojis) {
      const filename = `${crypto.randomUUID()}.png`;
      const filePath = path.join(emojiDir, filename);
      const urlPath = `/uploads/emoji/${filename}`;

      // Generate placeholder image
      const color = pickRandom(emojiColors);
      const imageBuffer = generatePlaceholderPNG(64, 64, color);
      fs.writeFileSync(filePath, imageBuffer);

      const emoji: CustomEmojiData = {
        id: crypto.randomUUID(),
        workspaceId: ws.id,
        name: emojiName,
        path: urlPath,
      };
      customEmojis.push(emoji);

      await db.insert(schema.customEmojis).values({
        id: emoji.id,
        workspaceId: ws.id,
        name: emoji.name,
        filename,
        path: urlPath,
        mimeType: "image/png",
        sizeBytes: imageBuffer.length,
        isAnimated: false,
        uploadedBy: ws.owner.id,
        createdAt: daysAgo(75),
      });
    }
  }
  console.log(`   Created ${customEmojis.length} custom emojis`);

  // ============================================
  // 12. CREATE MESSAGES
  // ============================================
  console.log("12. Creating messages (this may take a while)...");

  interface MessageData {
    id: string;
    content: string;
    authorId: string;
    channelId?: string;
    conversationId?: string;
    parentId?: string;
    sequence: number;
    createdAt: Date;
  }

  const allMessages: MessageData[] = [];
  const channelSequences: Map<string, number> = new Map();
  const conversationSequences: Map<string, number> = new Map();

  // Track parent messages for threads
  const threadParents: Map<string, MessageData[]> = new Map(); // channelId -> potential parents

  // Calculate message distribution
  const totalChannels = allChannels.length;
  const totalConversations = conversations.length;
  const channelMessageTarget = Math.floor(CONFIG.messagesTarget * 0.75);
  const dmMessageTarget = CONFIG.messagesTarget - channelMessageTarget;
  const messagesPerChannel = Math.floor(channelMessageTarget / totalChannels);
  const messagesPerConversation = Math.floor(dmMessageTarget / totalConversations);

  // Generate channel messages
  let messageCount = 0;
  for (const channel of allChannels) {
    const numMessages = messagesPerChannel + Math.floor(Math.random() * 20) - 10;
    const channelMessages: MessageData[] = [];

    // Generate message timestamps spread across the time range
    const timestamps: Date[] = [];
    for (let i = 0; i < numMessages; i++) {
      timestamps.push(workHoursDate(weightedRecentDate()));
    }
    timestamps.sort((a, b) => a.getTime() - b.getTime());

    for (let i = 0; i < numMessages; i++) {
      const author = pickRandom(channel.members);
      const seq = (channelSequences.get(channel.id) || 0) + 1;
      channelSequences.set(channel.id, seq);

      // Decide if this should be a thread reply
      let parentId: string | undefined;
      const existingParents = threadParents.get(channel.id) || [];

      if (existingParents.length > 0 && Math.random() < 0.15) {
        // Reply to existing thread
        const parent = pickRandom(existingParents);
        parentId = parent.id;
      }

      const msg: MessageData = {
        id: crypto.randomUUID(),
        content: generateMessage(channel.type, true, channel.members),
        authorId: author.id,
        channelId: channel.id,
        parentId,
        sequence: seq,
        createdAt: timestamps[i],
      };

      allMessages.push(msg);
      channelMessages.push(msg);

      // Some messages can become thread parents
      if (!parentId && Math.random() < 0.1) {
        if (!threadParents.has(channel.id)) {
          threadParents.set(channel.id, []);
        }
        threadParents.get(channel.id)!.push(msg);
      }

      messageCount++;
    }
  }

  // Generate DM messages
  for (const conv of conversations) {
    const numMessages = messagesPerConversation + Math.floor(Math.random() * 10) - 5;

    const timestamps: Date[] = [];
    for (let i = 0; i < Math.max(numMessages, 1); i++) {
      timestamps.push(workHoursDate(weightedRecentDate()));
    }
    timestamps.sort((a, b) => a.getTime() - b.getTime());

    for (let i = 0; i < Math.max(numMessages, 1); i++) {
      const author = pickRandom(conv.participants);
      const seq = (conversationSequences.get(conv.id) || 0) + 1;
      conversationSequences.set(conv.id, seq);

      const msg: MessageData = {
        id: crypto.randomUUID(),
        content: generateMessage("general", false),
        authorId: author.id,
        conversationId: conv.id,
        sequence: seq,
        createdAt: timestamps[i],
      };

      allMessages.push(msg);
      messageCount++;
    }
  }

  // Add some thread conversations
  console.log("   Adding thread conversations...");
  let threadCount = 0;
  for (const [channelId, parents] of threadParents) {
    const channel = allChannels.find(c => c.id === channelId)!;

    for (const parent of parents.slice(0, Math.min(parents.length, 5))) {
      const { replies } = generateThreadContent();

      for (let i = 0; i < replies.length; i++) {
        const author = pickRandom(channel.members);
        const seq = (channelSequences.get(channelId) || 0) + 1;
        channelSequences.set(channelId, seq);

        const replyTime = new Date(parent.createdAt.getTime() + (i + 1) * 10 * 60 * 1000);

        const msg: MessageData = {
          id: crypto.randomUUID(),
          content: replies[i],
          authorId: author.id,
          channelId,
          parentId: parent.id,
          sequence: seq,
          createdAt: replyTime,
        };

        allMessages.push(msg);
        messageCount++;
      }
      threadCount++;
    }
  }

  // Track reply counts
  const replyCountMap = new Map<string, number>();
  for (const msg of allMessages) {
    if (msg.parentId) {
      replyCountMap.set(msg.parentId, (replyCountMap.get(msg.parentId) || 0) + 1);
    }
  }

  // Insert messages in batches
  console.log(`   Inserting ${allMessages.length} messages...`);
  const batchSize = 100;
  for (let i = 0; i < allMessages.length; i += batchSize) {
    const batch = allMessages.slice(i, i + batchSize);
    await db.insert(schema.messages).values(
      batch.map(msg => ({
        id: msg.id,
        content: msg.content,
        authorId: msg.authorId,
        channelId: msg.channelId,
        conversationId: msg.conversationId,
        parentId: msg.parentId,
        sequence: msg.sequence,
        replyCount: replyCountMap.get(msg.id) || 0,
        createdAt: msg.createdAt,
        updatedAt: msg.createdAt,
      }))
    );

    if ((i + batchSize) % 1000 === 0 || i + batchSize >= allMessages.length) {
      process.stdout.write(`\r   Inserted ${Math.min(i + batchSize, allMessages.length)}/${allMessages.length} messages`);
    }
  }
  console.log(`\n   Created ${messageCount} messages (${threadCount} threads)`);

  // ============================================
  // 13. CREATE FILE ATTACHMENTS
  // ============================================
  console.log("13. Creating file attachments...");

  const attachmentDir = path.join(process.cwd(), "public", "uploads", "attachments");
  if (!fs.existsSync(attachmentDir)) {
    fs.mkdirSync(attachmentDir, { recursive: true });
  }

  const fileTypes = [
    { ext: "png", mime: "image/png", isImage: true },
    { ext: "pdf", mime: "application/pdf", isImage: false },
    { ext: "txt", mime: "text/plain", isImage: false },
  ];

  const fileNames = [
    "screenshot", "diagram", "report", "notes", "design", "spec",
    "mockup", "architecture", "flowchart", "presentation"
  ];

  // Select random channel messages to attach files to
  const channelMsgs = allMessages.filter(m => m.channelId);
  const msgsWithAttachments = pickRandomN(channelMsgs, Math.min(CONFIG.attachmentsTarget, channelMsgs.length));

  let attachmentCount = 0;
  for (const msg of msgsWithAttachments) {
    const fileType = pickRandom(fileTypes);
    const baseName = pickRandom(fileNames);
    const filename = `${crypto.randomUUID()}.${fileType.ext}`;
    const filePath = path.join(attachmentDir, filename);
    const urlPath = `/uploads/attachments/${filename}`;

    let fileContent: Buffer;
    let sizeBytes: number;

    if (fileType.ext === "png") {
      const color = pickRandom(emojiColors);
      fileContent = generatePlaceholderPNG(200 + Math.floor(Math.random() * 200), 150 + Math.floor(Math.random() * 150), color);
      sizeBytes = fileContent.length;
    } else if (fileType.ext === "pdf") {
      // Create a minimal PDF
      const pdfContent = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n172\n%%EOF`;
      fileContent = Buffer.from(pdfContent);
      sizeBytes = fileContent.length;
    } else {
      fileContent = Buffer.from(`Demo file content for ${baseName}\nGenerated at ${NOW.toISOString()}`);
      sizeBytes = fileContent.length;
    }

    fs.writeFileSync(filePath, fileContent);

    await db.insert(schema.fileAttachments).values({
      id: crypto.randomUUID(),
      messageId: msg.id,
      filename,
      originalName: `${baseName}.${fileType.ext}`,
      mimeType: fileType.mime,
      sizeBytes,
      path: urlPath,
      isImage: fileType.isImage,
      uploadedBy: msg.authorId,
      createdAt: msg.createdAt,
    });

    attachmentCount++;
  }
  console.log(`   Created ${attachmentCount} file attachments`);

  // ============================================
  // 14. CREATE REACTIONS
  // ============================================
  console.log("14. Creating reactions...");

  const reactionEmojis = ["👍", "❤️", "🎉", "🚀", "👀", "💯", "🔥", "⭐", "✅", "🙌"];
  const msgsForReactions = pickRandomN(allMessages, Math.floor(allMessages.length * 0.15));

  let reactionCount = 0;
  for (const msg of msgsForReactions) {
    const numReactions = 1 + Math.floor(Math.random() * 4);
    const channel = allChannels.find(c => c.id === msg.channelId);
    const conv = conversations.find(c => c.id === msg.conversationId);
    const possibleReactors = channel?.members || conv?.participants || [];

    if (possibleReactors.length === 0) continue;

    const reactors = pickRandomN(possibleReactors, Math.min(numReactions, possibleReactors.length));

    for (const reactor of reactors) {
      if (reactor.id === msg.authorId && Math.random() < 0.7) continue; // Less likely to react to own message

      await db.insert(schema.reactions).values({
        id: crypto.randomUUID(),
        messageId: msg.id,
        userId: reactor.id,
        emoji: pickRandom(reactionEmojis),
        createdAt: new Date(msg.createdAt.getTime() + Math.random() * 60 * 60 * 1000),
      });
      reactionCount++;
    }
  }
  console.log(`   Created ${reactionCount} reactions`);

  // ============================================
  // 15. CREATE PINNED MESSAGES
  // ============================================
  console.log("15. Creating pinned messages...");

  let pinnedCount = 0;
  for (const channel of allChannels) {
    const channelMsgs = allMessages.filter(m => m.channelId === channel.id && !m.parentId);
    if (channelMsgs.length === 0) continue;

    const numPins = Math.min(Math.floor(Math.random() * 3) + 1, channelMsgs.length);
    const pinnedMsgs = pickRandomN(channelMsgs, numPins);

    for (const msg of pinnedMsgs) {
      await db.insert(schema.pinnedMessages).values({
        id: crypto.randomUUID(),
        messageId: msg.id,
        channelId: channel.id,
        pinnedBy: pickRandom(channel.members).id,
        pinnedAt: new Date(msg.createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000),
      });
      pinnedCount++;
    }
  }
  console.log(`   Created ${pinnedCount} pinned messages`);

  // ============================================
  // 16. CREATE THREAD PARTICIPANTS
  // ============================================
  console.log("16. Creating thread participants...");

  const threadParentIds = [...replyCountMap.keys()];
  let threadParticipantCount = 0;

  for (const parentId of threadParentIds) {
    const parent = allMessages.find(m => m.id === parentId);
    if (!parent || !parent.channelId) continue;

    const channel = allChannels.find(c => c.id === parent.channelId);
    if (!channel) continue;

    // Find all authors who replied
    const threadReplies = allMessages.filter(m => m.parentId === parentId);
    const participantIds = new Set([parent.authorId, ...threadReplies.map(r => r.authorId)]);

    for (const userId of participantIds) {
      await db.insert(schema.threadParticipants).values({
        id: crypto.randomUUID(),
        threadId: parentId,
        userId,
        lastReadAt: NOW,
        joinedAt: parent.createdAt,
      });
      threadParticipantCount++;
    }
  }
  console.log(`   Created ${threadParticipantCount} thread participants`);

  // ============================================
  // 17. CREATE CHANNEL NOTES
  // ============================================
  console.log("17. Creating channel notes...");

  const noteContents = [
    "# Channel Guidelines\n\nPlease keep discussions on-topic and respectful.\n\n## Important Links\n- Documentation: https://docs.example.com\n- Wiki: https://wiki.example.com",
    "# Sprint Notes\n\n## Current Sprint\n- Feature A: In Progress\n- Bug fix B: Done\n- Feature C: Planning\n\n## Next Sprint\n- TBD",
    "# Meeting Notes\n\n## Action Items\n- [ ] Review PRs\n- [ ] Update documentation\n- [x] Deploy to staging",
    "# Team Resources\n\n- Onboarding doc: [link]\n- Style guide: [link]\n- Architecture overview: [link]",
    "# Quick Reference\n\n```bash\nnpm run dev\nnpm run test\nnpm run build\n```",
  ];

  let channelNoteCount = 0;
  for (const channel of allChannels) {
    if (Math.random() < 0.4) continue; // Only 60% of channels have notes

    await db.insert(schema.channelNotes).values({
      id: crypto.randomUUID(),
      channelId: channel.id,
      content: pickRandom(noteContents),
      version: 1,
      updatedBy: pickRandom(channel.members).id,
      createdAt: daysAgo(60),
      updatedAt: hoursAgo(Math.floor(Math.random() * 72)),
    });
    channelNoteCount++;
  }
  console.log(`   Created ${channelNoteCount} channel notes`);

  // ============================================
  // 18. CREATE PERSONAL NOTES
  // ============================================
  console.log("18. Creating personal notes...");

  const personalNoteContents = [
    "# My TODO\n\n- [ ] Review Alice's PR\n- [ ] Update API docs\n- [ ] Prepare for 1:1\n- [x] Submit timesheet",
    "# Ideas\n\n- Improve caching strategy\n- Add dark mode support\n- Refactor authentication flow",
    "# Meeting Notes\n\n## Weekly sync\n- Discussed Q2 goals\n- Need to follow up on deployment",
    "# Bookmarks\n\n- Important thread in #engineering\n- Design specs for new feature",
  ];

  let personalNoteCount = 0;
  for (const ws of workspaces) {
    const usersWithNotes = pickRandomN(ws.members, Math.floor(ws.members.length * 0.5));

    for (const user of usersWithNotes) {
      await db.insert(schema.personalNotes).values({
        id: crypto.randomUUID(),
        userId: user.id,
        organizationId: ws.id,
        content: pickRandom(personalNoteContents),
        version: 1,
        createdAt: daysAgo(45),
        updatedAt: hoursAgo(Math.floor(Math.random() * 48)),
      });
      personalNoteCount++;
    }
  }
  console.log(`   Created ${personalNoteCount} personal notes`);

  // ============================================
  // 19. CREATE BOOKMARKS
  // ============================================
  console.log("19. Creating bookmarks...");

  let bookmarkCount = 0;
  for (const ws of workspaces) {
    const usersWithBookmarks = pickRandomN(ws.members, Math.floor(ws.members.length * 0.3));

    for (const user of usersWithBookmarks) {
      const wsChannels = allChannels.filter(c => c.workspaceId === ws.id && c.members.some(m => m.id === user.id));
      const wsMessages = allMessages.filter(m => wsChannels.some(c => c.id === m.channelId));

      if (wsMessages.length === 0) continue;

      const bookmarkedMsgs = pickRandomN(wsMessages, Math.min(5, wsMessages.length));

      for (const msg of bookmarkedMsgs) {
        await db.insert(schema.bookmarks).values({
          id: crypto.randomUUID(),
          userId: user.id,
          type: "message",
          messageId: msg.id,
          note: Math.random() < 0.3 ? "Important reference" : null,
          createdAt: new Date(msg.createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000),
        });
        bookmarkCount++;
      }
    }
  }
  console.log(`   Created ${bookmarkCount} bookmarks`);

  // ============================================
  // 20. CREATE REMINDERS
  // ============================================
  console.log("20. Creating reminders...");

  let reminderCount = 0;
  for (const ws of workspaces) {
    const usersWithReminders = pickRandomN(ws.members, Math.floor(ws.members.length * 0.2));

    for (const user of usersWithReminders) {
      const wsChannels = allChannels.filter(c => c.workspaceId === ws.id && c.members.some(m => m.id === user.id));
      const wsMessages = allMessages.filter(m => wsChannels.some(c => c.id === m.channelId));

      if (wsMessages.length === 0) continue;

      const reminderMsgs = pickRandomN(wsMessages, Math.min(2, wsMessages.length));

      for (const msg of reminderMsgs) {
        const remindAt = new Date(NOW.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);

        await db.insert(schema.reminders).values({
          id: crypto.randomUUID(),
          userId: user.id,
          messageId: msg.id,
          note: Math.random() < 0.5 ? "Follow up on this" : null,
          remindAt,
          status: "pending",
          createdAt: NOW,
          updatedAt: NOW,
        });
        reminderCount++;
      }
    }
  }
  console.log(`   Created ${reminderCount} reminders`);

  // ============================================
  // 21. CREATE NOTIFICATIONS
  // ============================================
  console.log("21. Creating notifications...");

  const notificationTypes = ["mention", "channel", "thread_reply"];
  let notificationCount = 0;

  // Create some notifications for recent messages
  const recentMessages = allMessages.filter(m => m.createdAt > daysAgo(7));
  const msgsForNotifications = pickRandomN(recentMessages, Math.min(200, recentMessages.length));

  for (const msg of msgsForNotifications) {
    const channel = allChannels.find(c => c.id === msg.channelId);
    if (!channel) continue;

    const recipient = pickRandom(channel.members.filter(m => m.id !== msg.authorId));
    if (!recipient) continue;

    await db.insert(schema.notifications).values({
      id: crypto.randomUUID(),
      userId: recipient.id,
      type: pickRandom(notificationTypes),
      messageId: msg.id,
      channelId: msg.channelId,
      actorId: msg.authorId,
      content: msg.content.slice(0, 100),
      readAt: Math.random() < 0.6 ? NOW : null,
      createdAt: msg.createdAt,
    });
    notificationCount++;
  }
  console.log(`   Created ${notificationCount} notifications`);

  // ============================================
  // 22. CREATE CHANNEL READ STATES
  // ============================================
  console.log("22. Creating channel read states...");

  let readStateCount = 0;
  for (const channel of allChannels) {
    const maxSeq = channelSequences.get(channel.id) || 0;

    for (const member of channel.members) {
      // Most users are caught up, some have unread
      const lastReadSeq = Math.random() < 0.7 ? maxSeq : Math.floor(maxSeq * (0.7 + Math.random() * 0.3));

      await db.insert(schema.channelReadState).values({
        id: crypto.randomUUID(),
        userId: member.id,
        channelId: channel.id,
        lastReadSequence: lastReadSeq,
        updatedAt: NOW,
      });
      readStateCount++;
    }
  }

  for (const conv of conversations) {
    const maxSeq = conversationSequences.get(conv.id) || 0;

    for (const participant of conv.participants) {
      await db.insert(schema.channelReadState).values({
        id: crypto.randomUUID(),
        userId: participant.id,
        conversationId: conv.id,
        lastReadSequence: maxSeq,
        updatedAt: NOW,
      });
      readStateCount++;
    }
  }
  console.log(`   Created ${readStateCount} read states`);

  // ============================================
  // 23. CREATE NOTIFICATION SETTINGS
  // ============================================
  console.log("23. Creating notification settings...");

  let notifSettingCount = 0;
  const notifModes = ["all", "mentions", "muted"];

  for (const ws of workspaces) {
    const usersWithSettings = pickRandomN(ws.members, Math.floor(ws.members.length * 0.3));

    for (const user of usersWithSettings) {
      const wsChannels = allChannels.filter(c => c.workspaceId === ws.id && c.members.some(m => m.id === user.id));
      const channelsToCustomize = pickRandomN(wsChannels, Math.min(3, wsChannels.length));

      for (const channel of channelsToCustomize) {
        await db.insert(schema.channelNotificationSettings).values({
          id: crypto.randomUUID(),
          userId: user.id,
          channelId: channel.id,
          mode: pickRandom(notifModes.slice(1)), // Exclude "all" since that's default
          updatedAt: NOW,
        });
        notifSettingCount++;
      }
    }
  }
  console.log(`   Created ${notifSettingCount} notification settings`);

  // ============================================
  // 24. CREATE LINK PREVIEWS (for messages with URLs)
  // ============================================
  console.log("24. Creating link previews...");

  const msgsWithLinks = allMessages.filter(m => m.content.includes("https://"));
  let linkPreviewCount = 0;

  for (const msg of msgsWithLinks) {
    const urlMatch = msg.content.match(/https:\/\/[^\s]+/);
    if (!urlMatch) continue;

    const url = urlMatch[0];

    // Check if preview already exists
    const existingPreview = await db.query.linkPreviews.findFirst({
      where: eq(schema.linkPreviews.url, url),
    });

    let previewId: string;

    if (existingPreview) {
      previewId = existingPreview.id;
    } else {
      previewId = crypto.randomUUID();
      await db.insert(schema.linkPreviews).values({
        id: previewId,
        url,
        title: `Page Title for ${url.split('/')[2]}`,
        description: "This is a description of the linked page content.",
        siteName: url.split('/')[2],
        fetchedAt: msg.createdAt,
        expiresAt: new Date(msg.createdAt.getTime() + 24 * 60 * 60 * 1000),
      });
    }

    await db.insert(schema.messageLinkPreviews).values({
      id: crypto.randomUUID(),
      messageId: msg.id,
      linkPreviewId: previewId,
      position: 0,
      hidden: false,
    });
    linkPreviewCount++;
  }
  console.log(`   Created ${linkPreviewCount} link previews`);

  // ============================================
  // 25. CREATE INVITATIONS
  // ============================================
  console.log("25. Creating pending invitations...");

  let invitationCount = 0;
  for (const ws of workspaces) {
    const numInvites = 1 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numInvites; i++) {
      await db.insert(schema.invitations).values({
        id: genId(),
        email: `invited${i + 1}@${ws.slug}.example.com`,
        organizationId: ws.id,
        inviterId: ws.owner.id,
        role: "member",
        status: "pending",
        expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: daysAgo(3),
      });
      invitationCount++;
    }
  }
  console.log(`   Created ${invitationCount} pending invitations`);

  // ============================================
  // 26. CREATE GUEST MEMBERS
  // ============================================
  console.log("26. Creating guest members...");

  let guestMemberCount = 0;
  const guestMemberIds: Map<string, string> = new Map(); // key: `${wsId}:${userId}`, value: memberId

  // Add 1-2 guests to each workspace
  for (const ws of workspaces) {
    const nonMembers = users.filter(u => !ws.members.includes(u));
    const guestCandidates = pickRandomN(nonMembers, Math.min(2, nonMembers.length));

    for (const guest of guestCandidates) {
      const memberId = genId();
      guestMemberIds.set(`${ws.id}:${guest.id}`, memberId);

      await db.insert(schema.members).values({
        id: memberId,
        organizationId: ws.id,
        userId: guest.id,
        role: "member",
        isGuest: true,
        guestExpiresAt: new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days
        createdAt: daysAgo(7),
      });

      // Grant guest access to general channel
      const generalChannel = allChannels.find(c => c.workspaceId === ws.id && c.slug === "general");
      if (generalChannel) {
        await db.insert(schema.guestChannelAccess).values({
          memberId: memberId,
          channelId: generalChannel.id,
          grantedAt: daysAgo(7),
        });

        // Add as channel member
        await db.insert(schema.channelMembers).values({
          id: crypto.randomUUID(),
          channelId: generalChannel.id,
          userId: guest.id,
          role: "member",
          joinedAt: daysAgo(7),
        });
      }

      guestMemberCount++;
    }
  }
  console.log(`   Created ${guestMemberCount} guest members`);

  // ============================================
  // 27. CREATE WORKSPACE JOIN REQUESTS
  // ============================================
  console.log("27. Creating workspace join requests...");

  let joinRequestCount = 0;

  // Create join requests for workspaces with "request" policy
  for (const ws of workspaces) {
    if (ws.joinPolicy !== "request") continue;

    // Create 2-3 pending requests from non-members
    const nonMembers = users.filter(u => !ws.members.includes(u) && !guestMemberIds.has(`${ws.id}:${u.id}`));
    const requesters = pickRandomN(nonMembers, Math.min(3, nonMembers.length));

    for (const requester of requesters) {
      await db.insert(schema.workspaceJoinRequests).values({
        userId: requester.id,
        organizationId: ws.id,
        message: pickRandom([
          `I'd love to join ${ws.name}! I'm interested in collaborating with the team.`,
          `Excited about what you're building. Would love to contribute!`,
          `Looking forward to being part of the ${ws.name} community.`,
          `I have experience in this area and would like to participate.`,
        ]),
        status: "pending",
        createdAt: daysAgo(Math.floor(Math.random() * 7)),
      });
      joinRequestCount++;
    }

    // Create 1-2 approved requests (historical)
    const approvedMembers = ws.members.slice(3, 5); // Some regular members came through request
    const adminUser = ws.members.find((_, idx) => idx < 3); // Admins

    for (const member of approvedMembers) {
      if (!adminUser) continue;
      await db.insert(schema.workspaceJoinRequests).values({
        userId: member.id,
        organizationId: ws.id,
        message: "Excited to join the team!",
        status: "approved",
        createdAt: daysAgo(30 + Math.floor(Math.random() * 30)),
        reviewedAt: daysAgo(28 + Math.floor(Math.random() * 28)),
        reviewedBy: adminUser.id,
      });
      joinRequestCount++;
    }

    // Create 1 rejected request
    const rejectedUser = pickRandom(nonMembers.filter(u => !requesters.includes(u)));
    if (rejectedUser && adminUser) {
      await db.insert(schema.workspaceJoinRequests).values({
        userId: rejectedUser.id,
        organizationId: ws.id,
        message: "I want to join this workspace.",
        status: "rejected",
        rejectionReason: "We're not accepting new members at this time. Please try again later.",
        createdAt: daysAgo(45),
        reviewedAt: daysAgo(42),
        reviewedBy: adminUser.id,
      });
      joinRequestCount++;
    }
  }
  console.log(`   Created ${joinRequestCount} workspace join requests`);

  // ============================================
  // 28. CREATE GUEST INVITES
  // ============================================
  console.log("28. Creating guest invites...");

  let guestInviteCount = 0;

  for (const ws of workspaces) {
    const generalChannel = allChannels.find(c => c.workspaceId === ws.id && c.slug === "general");
    const helpChannel = allChannels.find(c => c.workspaceId === ws.id && (c.slug === "help" || c.slug === "introductions"));
    const channelIds: string[] = [];
    if (generalChannel) channelIds.push(generalChannel.id);
    if (helpChannel) channelIds.push(helpChannel.id);

    if (channelIds.length > 0) {
      // Active guest invite
      await db.insert(schema.guestInvites).values({
        organizationId: ws.id,
        token: `guest-${ws.slug}-${nanoid(12)}`,
        createdBy: ws.owner.id,
        expiresAt: new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000),
        channelIds: JSON.stringify(channelIds),
        createdAt: daysAgo(5),
      });
      guestInviteCount++;

      // Expired guest invite
      await db.insert(schema.guestInvites).values({
        organizationId: ws.id,
        token: `expired-${ws.slug}-${nanoid(12)}`,
        createdBy: ws.owner.id,
        expiresAt: daysAgo(1),
        channelIds: JSON.stringify(channelIds),
        createdAt: daysAgo(20),
      });
      guestInviteCount++;

      // Used guest invite
      const guestKey = Array.from(guestMemberIds.keys()).find(k => k.startsWith(ws.id));
      if (guestKey) {
        const guestUserId = guestKey.split(':')[1];
        await db.insert(schema.guestInvites).values({
          organizationId: ws.id,
          token: `used-${ws.slug}-${nanoid(12)}`,
          createdBy: ws.owner.id,
          channelIds: JSON.stringify(channelIds),
          usedBy: guestUserId,
          usedAt: daysAgo(7),
          createdAt: daysAgo(10),
        });
        guestInviteCount++;
      }
    }
  }
  console.log(`   Created ${guestInviteCount} guest invites`);

  // ============================================
  // 29. CREATE SIDEBAR PREFERENCES
  // ============================================
  console.log("29. Creating sidebar preferences...");

  let sidebarPrefCount = 0;
  const defaultSectionOrder = ['threads', 'search', 'notes', 'scheduled', 'reminders', 'saved'];

  for (const ws of workspaces) {
    // Give ~30% of workspace members customized sidebar preferences
    const membersWithPrefs = pickRandomN(ws.members, Math.floor(ws.members.length * 0.3));

    for (let i = 0; i < membersWithPrefs.length; i++) {
      const member = membersWithPrefs[i];
      const wsConversations = conversations.filter(c =>
        c.workspaceId === ws.id && c.participants.includes(member)
      );

      const preferences = {
        categoryOrder: [] as string[],
        dmOrder: wsConversations.map(c => c.id),
        sectionOrder: i % 3 === 0 ? defaultSectionOrder :
          i % 3 === 1 ? ['notes', 'threads', 'search', 'saved', 'scheduled', 'reminders'] :
            ['search', 'saved', 'threads', 'notes', 'scheduled', 'reminders'],
        hiddenSections: i % 4 === 0 ? ['scheduled'] : [],
        collapsedSections: i % 5 === 0 ? ['reminders', 'saved'] : [],
        updatedAt: NOW.toISOString(),
      };

      await db.insert(schema.userSidebarPreferences).values({
        userId: member.id,
        organizationId: ws.id,
        preferences,
        createdAt: daysAgo(Math.floor(Math.random() * 30)),
        updatedAt: NOW,
      });
      sidebarPrefCount++;
    }
  }
  console.log(`   Created ${sidebarPrefCount} sidebar preferences`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log("  DEMO SEED COMPLETE!");
  console.log("=".repeat(60));

  console.log("\n📊 Data Summary:");
  console.log("-".repeat(40));
  console.log(`  Users:              ${users.length}`);
  console.log(`  Workspaces:         ${workspaces.length}`);
  console.log(`  Channels:           ${allChannels.length}`);
  console.log(`  Conversations:      ${conversations.length}`);
  console.log(`  Messages:           ${allMessages.length}`);
  console.log(`  Threads:            ${threadParentIds.length}`);
  console.log(`  Reactions:          ${reactionCount}`);
  console.log(`  File Attachments:   ${attachmentCount}`);
  console.log(`  Custom Emojis:      ${customEmojis.length}`);
  console.log(`  User Groups:        ${userGroups.length}`);
  console.log(`  Channel Notes:      ${channelNoteCount}`);
  console.log(`  Personal Notes:     ${personalNoteCount}`);
  console.log(`  Bookmarks:          ${bookmarkCount}`);
  console.log(`  Reminders:          ${reminderCount}`);
  console.log(`  Guest Members:      ${guestMemberCount}`);
  console.log(`  Join Requests:      ${joinRequestCount}`);
  console.log(`  Guest Invites:      ${guestInviteCount}`);
  console.log(`  Sidebar Prefs:      ${sidebarPrefCount}`);

  console.log(`\n🔐 Test Accounts (password: '${CONFIG.testPassword}'):`);
  console.log("-".repeat(40));
  for (let i = 0; i < Math.min(10, users.length); i++) {
    console.log(`  ${users[i].email.padEnd(35)} ${users[i].name}`);
  }
  if (users.length > 10) {
    console.log(`  ... and ${users.length - 10} more users`);
  }

  console.log("\n🏢 Workspaces (with visibility policies):");
  console.log("-".repeat(40));
  for (const ws of workspaces) {
    const policyLabel = ws.joinPolicy === "invite_only" ? "Private" :
                        ws.joinPolicy === "request" ? "Request" : "Open";
    console.log(`  /${ws.slug.padEnd(20)} [${policyLabel.padEnd(7)}] ${ws.name} (${ws.members.length} members)`);
  }

  console.log("\n🔒 Visibility Policies:");
  console.log("-".repeat(40));
  console.log("  Private (invite_only) - Hidden from browse, invitation only");
  console.log("  Request               - Visible in browse, requires admin approval");
  console.log("  Open                  - Visible in browse, instant join");

  console.log("\n📅 Date Range:");
  console.log("-".repeat(40));
  console.log(`  From: ${THREE_MONTHS_AGO.toISOString().split('T')[0]}`);
  console.log(`  To:   ${NOW.toISOString().split('T')[0]}`);

  console.log("\n🚀 To access the demo:");
  console.log("-".repeat(40));
  console.log("  1. Start the dev server: npm run dev");
  console.log("  2. Visit: http://localhost:3000/login");
  console.log("  3. Login with any test account above");
  console.log("");
}

// Run the seed
seed()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

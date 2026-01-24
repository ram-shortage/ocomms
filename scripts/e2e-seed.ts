/**
 * E2E Test Seed Script for OComms
 *
 * Creates minimal test data required for E2E tests:
 * - Alice and Bob test users with known credentials
 * - acme-corp workspace with basic channels
 *
 * Usage: DATABASE_URL=... npx tsx scripts/e2e-seed.ts
 *
 * SECURITY: This script creates test users with known passwords.
 * It MUST NOT be run in production environments.
 */

import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
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
    console.error("  REFUSED: Cannot seed E2E test data in production");
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

// Generate IDs like better-auth
const genId = () => nanoid(24);

// E2E Test users - credentials must match e2e/tests/auth.setup.ts
const TEST_PASSWORD = "password123";

interface UserSeed {
  id: string;
  name: string;
  email: string;
}

const usersData: UserSeed[] = [
  { id: genId(), name: "Alice Chen", email: "alice@demo.ocomms.local" },
  { id: genId(), name: "Bob Martinez", email: "bob@demo.ocomms.local" },
];

// Organization data
interface OrgSeed {
  id: string;
  name: string;
  slug: string;
}

const orgsData: OrgSeed[] = [
  { id: genId(), name: "Acme Corporation", slug: "acme-corp" },
];

// Channel data (no id - UUID auto-generated)
interface ChannelSeed {
  name: string;
  slug: string;
  description: string;
  isPrivate: boolean;
}

const channelsData: ChannelSeed[] = [
  {
    name: "general",
    slug: "general",
    description: "Company-wide announcements and updates",
    isPrivate: false,
  },
  {
    name: "random",
    slug: "random",
    description: "Random chat and fun stuff",
    isPrivate: false,
  },
  {
    name: "engineering",
    slug: "engineering",
    description: "Engineering team discussions",
    isPrivate: false,
  },
];

async function seed() {
  console.log("Starting E2E seed...");

  // Hash the test password
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const now = new Date();

  // Create users
  console.log("Creating test users...");
  const users: typeof schema.users.$inferSelect[] = [];

  for (const userData of usersData) {
    // Check if user exists
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, userData.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  User ${userData.email} already exists, skipping`);
      users.push(existing[0]);
      continue;
    }

    const [user] = await db
      .insert(schema.users)
      .values({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Create account record for password auth
    await db.insert(schema.accounts).values({
      id: genId(),
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`  Created user: ${user.email}`);
    users.push(user);
  }

  // Create organization
  console.log("Creating organization...");
  let org: typeof schema.organizations.$inferSelect;

  const existingOrg = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, orgsData[0].slug))
    .limit(1);

  if (existingOrg.length > 0) {
    console.log(`  Organization ${orgsData[0].slug} already exists, skipping`);
    org = existingOrg[0];
  } else {
    [org] = await db
      .insert(schema.organizations)
      .values({
        id: orgsData[0].id,
        name: orgsData[0].name,
        slug: orgsData[0].slug,
        createdAt: now,
      })
      .returning();
    console.log(`  Created organization: ${org.name}`);
  }

  // Add users as members
  console.log("Adding members to organization...");
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const role = i === 0 ? "owner" : "member";

    const existingMember = await db
      .select()
      .from(schema.members)
      .where(eq(schema.members.userId, user.id))
      .limit(1);

    if (existingMember.length > 0) {
      console.log(`  Member ${user.email} already exists, skipping`);
      continue;
    }

    await db.insert(schema.members).values({
      id: genId(),
      userId: user.id,
      organizationId: org.id,
      role,
      createdAt: now,
    });
    console.log(`  Added ${user.email} as ${role}`);
  }

  // Create channels
  console.log("Creating channels...");
  const channels: typeof schema.channels.$inferSelect[] = [];

  for (const channelData of channelsData) {
    const existing = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.slug, channelData.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Channel ${channelData.slug} already exists, skipping`);
      channels.push(existing[0]);
      continue;
    }

    const [channel] = await db
      .insert(schema.channels)
      .values({
        // id is auto-generated UUID
        organizationId: org.id,
        name: channelData.name,
        slug: channelData.slug,
        description: channelData.description,
        isPrivate: channelData.isPrivate,
        createdBy: users[0].id,
        createdAt: now,
      })
      .returning();

    console.log(`  Created channel: ${channel.name}`);
    channels.push(channel);
  }

  // Add all users to all channels
  console.log("Adding members to channels...");
  for (const channel of channels) {
    for (const user of users) {
      const existing = await db
        .select()
        .from(schema.channelMembers)
        .where(eq(schema.channelMembers.channelId, channel.id))
        .limit(1);

      // Simple check - if any member exists, assume all are added
      if (existing.some((m) => m.userId === user.id)) {
        continue;
      }

      await db.insert(schema.channelMembers).values({
        // id is auto-generated UUID
        channelId: channel.id,
        userId: user.id,
        joinedAt: now,
      });
    }
  }

  // Create a welcome message in general
  console.log("Creating welcome message...");
  const generalChannel = channels.find((c) => c.slug === "general");
  if (generalChannel) {
    const existingMessages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.channelId, generalChannel.id))
      .limit(1);

    if (existingMessages.length === 0) {
      await db.insert(schema.messages).values({
        // id is auto-generated UUID
        channelId: generalChannel.id,
        authorId: users[0].id,
        content: "Welcome to the E2E test workspace! This is a test message.",
        sequence: 1,
        createdAt: now,
      });
      console.log("  Created welcome message");
    }
  }

  console.log("\nE2E seed completed!");
  console.log("\nTest credentials:");
  console.log("  Alice: alice@demo.ocomms.local / password123");
  console.log("  Bob: bob@demo.ocomms.local / password123");
  console.log("  Workspace: acme-corp");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

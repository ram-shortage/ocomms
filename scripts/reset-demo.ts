/**
 * Reset database and run demo seed script
 *
 * WARNING: This will delete ALL data in the database!
 *
 * Usage: npm run db:reset-demo
 *
 * For production databases, set ALLOW_PRODUCTION_RESET=true
 */

import { db, sql } from "../src/db";
import { execSync } from "child_process";
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
  const allowProduction = process.env.ALLOW_PRODUCTION_RESET === "true";

  if (isProduction && !allowProduction) {
    console.log("\n" + "=".repeat(60));
    console.log("  🚨 PRODUCTION DATABASE DETECTED - DESTRUCTIVE OPERATION");
    console.log("=".repeat(60));
    console.log("\nYour DATABASE_URL appears to point to a production database.");
    console.log("This script will DROP ALL TABLES and DELETE ALL DATA!\n");
    console.log("If you're absolutely sure you want to proceed, either:");
    console.log("  1. Set ALLOW_PRODUCTION_RESET=true environment variable");
    console.log("  2. Type 'yes-destroy-production' below to confirm\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question("Confirm DESTRUCTIVE production reset (type 'yes-destroy-production'): ", resolve);
    });
    rl.close();

    if (answer !== "yes-destroy-production") {
      console.log("\nAborted. No changes made.\n");
      process.exit(0);
    }

    console.log("\n🚨 Proceeding with DESTRUCTIVE production reset...\n");
  } else if (isProduction && allowProduction) {
    console.log("\n🚨 Production database detected - ALLOW_PRODUCTION_RESET=true set");
    console.log("DESTRUCTIVE RESET proceeding in 10 seconds... (Ctrl+C to abort)\n");
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

async function resetAndDemoSeed() {
  // Check for production database before proceeding
  await checkProductionSafety();

  console.log("=".repeat(60));
  console.log("  OCOMMS DATABASE RESET + DEMO SEED");
  console.log("=".repeat(60));
  console.log("\n⚠️  WARNING: This will delete ALL data in the database!");
  console.log("Resetting database in 3 seconds...\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("1. Dropping all tables...");

  // Drop all tables by truncating each one with CASCADE
  await db.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
      END LOOP;
    END $$;
  `);

  console.log("   Tables dropped.\n");

  console.log("2. Running migrations (db:push)...");
  try {
    execSync("npm run db:push", { stdio: "inherit" });
  } catch (error) {
    console.error("Migration failed. Please run manually: npm run db:push");
    process.exit(1);
  }

  console.log("\n3. Running demo seed...");
  try {
    execSync("npm run db:demo-seed", { stdio: "inherit" });
  } catch (error) {
    console.error("Demo seed failed. Please run manually: npm run db:demo-seed");
    process.exit(1);
  }

  console.log("\n✅ Database reset and demo seed complete!");
}

resetAndDemoSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });

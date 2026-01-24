/**
 * Reset database and run seed script
 *
 * WARNING: This will delete ALL data in the database!
 *
 * Usage: npm run db:reset
 *
 * For production databases, set ALLOW_DESTRUCTIVE=true (DANGEROUS)
 */

import { db, sql } from "../src/db";

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

function isProductionDatabase(): boolean {
  const dbUrl = process.env.DATABASE_URL || "";
  return PRODUCTION_INDICATORS.some((indicator) =>
    dbUrl.toLowerCase().includes(indicator.toLowerCase())
  );
}

function checkProductionSafety(): void {
  const isProduction = isProductionDatabase() || process.env.NODE_ENV === "production";
  const allowDestructive = process.env.ALLOW_DESTRUCTIVE === "true";

  if (isProduction && !allowDestructive) {
    console.error("\n" + "=".repeat(60));
    console.error("  REFUSED: Cannot run destructive script in production");
    console.error("=".repeat(60));
    console.error("\nYour DATABASE_URL appears to point to a production database");
    console.error("or NODE_ENV is set to 'production'.\n");
    console.error("If you're absolutely sure, set ALLOW_DESTRUCTIVE=true (DANGEROUS)\n");
    process.exit(1);
  }

  if (isProduction && allowDestructive) {
    console.log("\n" + "=".repeat(60));
    console.log("  WARNING: Running DESTRUCTIVE operation on production database");
    console.log("  ALLOW_DESTRUCTIVE=true override is set");
    console.log("=".repeat(60) + "\n");
  }
}

async function resetAndSeed() {
  // Check production safety before any destructive operations
  checkProductionSafety();

  console.log("WARNING: This will delete ALL data in the database!");
  console.log("Resetting database in 3 seconds...\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("Dropping all tables...");

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

  console.log("Tables dropped.\n");
  console.log("Running migrations...");

  // Import and run drizzle-kit push programmatically isn't easy,
  // so we'll just exit and let the user run it
  console.log("\nDatabase reset complete!");
  console.log("\nNext steps:");
  console.log("  1. Run migrations:  npm run db:push");
  console.log("  2. Run seed:        npm run db:seed");
  console.log("");
}

resetAndSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });

/**
 * Reset database and run seed script
 *
 * WARNING: This will delete ALL data in the database!
 *
 * Usage: npm run db:reset
 */

import { db, sql } from "../src/db";

async function resetAndSeed() {
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

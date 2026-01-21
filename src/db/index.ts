import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export { sql };

// Create database connection only when DATABASE_URL is available
// During Next.js build phase, DATABASE_URL may not be set
function createDb() {
  // Read DATABASE_URL at runtime, not module load time
  // This ensures dotenv has loaded before we access the variable
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Determine SSL mode: only use SSL if explicitly specified in connection string
  // Internal Docker network doesn't need SSL; external connections should specify sslmode
  const useSSL = connectionString.includes("sslmode=require");

  const client = postgres(connectionString, {
    // postgres.js accepts: false, true, 'require', 'prefer', or tls.connect options
    ssl: useSSL ? "require" : false,
  });

  return drizzle(client, {
    schema,
    casing: "snake_case",
  });
}

// Lazy initialization - db is only created when first accessed at runtime
// This allows Next.js build to complete without DATABASE_URL
let _db: ReturnType<typeof createDb> | null = null;

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    if (!_db) {
      _db = createDb();
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});

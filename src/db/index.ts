import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export { sql };

const connectionString = process.env.DATABASE_URL!;

// Determine SSL mode: use sslmode from URL if specified, otherwise require in production
const useSSL =
  connectionString.includes("sslmode=") ||
  process.env.NODE_ENV === "production";

const client = postgres(connectionString, {
  // postgres.js accepts: false, true, 'require', 'prefer', or tls.connect options
  ssl: useSSL ? "require" : false,
});

export const db = drizzle(client, {
  schema,
  casing: "snake_case",
});

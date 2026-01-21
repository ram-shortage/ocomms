import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

// Only use SSL if explicitly specified in connection string
const useSSL = connectionString.includes("sslmode=require");

const sql = postgres(connectionString, {
  ssl: useSSL ? "require" : false,
  max: 1,
});
const db = drizzle(sql);

console.log("Running database migrations...");

await migrate(db, { migrationsFolder: "./src/db/migrations" });

console.log("Migrations complete");
await sql.end();
process.exit(0);

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql);

console.log("Running database migrations...");

await migrate(db, { migrationsFolder: "./src/db/migrations" });

console.log("Migrations complete");
await sql.end();
process.exit(0);

import { config } from "dotenv";
import { existsSync } from "node:fs";

// Load .env.local first (higher priority), then .env (like Next.js)
if (existsSync(".env.local")) {
  config({ path: ".env.local" });
}
config(); // loads .env, won't override existing values

import { Worker } from "bullmq";
import { getQueueConnection } from "@/server/queue/connection";

// Placeholder workers - real processors added in later plans
const scheduledMessageWorker = new Worker(
  "scheduled-messages",
  async (job) => {
    console.log("[Worker] Processing scheduled message:", job.data);
    // TODO: Implement in Plan 03
    return { processed: true };
  },
  { connection: getQueueConnection(), concurrency: 5 }
);

const reminderWorker = new Worker(
  "reminders",
  async (job) => {
    console.log("[Worker] Processing reminder:", job.data);
    // TODO: Implement in Plan 04
    return { processed: true };
  },
  { connection: getQueueConnection(), concurrency: 5 }
);

console.log("[Worker] BullMQ workers started");

// Graceful shutdown
const shutdown = async () => {
  console.log("[Worker] Shutting down...");
  await scheduledMessageWorker.close();
  await reminderWorker.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

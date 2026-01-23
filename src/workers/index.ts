import { config } from "dotenv";
import { existsSync } from "node:fs";

// Load .env.local first (higher priority), then .env (like Next.js)
if (existsSync(".env.local")) {
  config({ path: ".env.local" });
}
config(); // loads .env, won't override existing values

import { createScheduledMessageWorker } from "./scheduled-message.worker";
import { createReminderWorker } from "./reminder.worker";
import { createStatusExpirationWorker } from "./status-expiration.worker";
import { createLinkPreviewWorker } from "./link-preview.worker";
import { createGuestExpirationWorker } from "./guest-expiration.worker";
import { createAttachmentCleanupWorker } from "./attachment-cleanup.worker";
import { closeEmitter } from "@/server/queue/emitter";

// Real scheduled message worker - Plan 03
const scheduledMessageWorker = createScheduledMessageWorker();

// Real reminder worker - Plan 04
const reminderWorker = createReminderWorker();

// Status expiration worker - Phase 26
const statusExpirationWorker = createStatusExpirationWorker();

// Link preview worker - Phase 27
const linkPreviewWorker = createLinkPreviewWorker();

// Guest expiration worker - Phase 28
const guestExpirationWorker = createGuestExpirationWorker();

// Attachment cleanup worker - Phase 32
const attachmentCleanupWorker = createAttachmentCleanupWorker();

console.log("[Worker] BullMQ workers started");

// Graceful shutdown
const shutdown = async () => {
  console.log("[Worker] Shutting down...");
  await scheduledMessageWorker.close();
  await reminderWorker.close();
  await statusExpirationWorker.close();
  await linkPreviewWorker.close();
  await guestExpirationWorker.close();
  await attachmentCleanupWorker.close();
  await closeEmitter();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

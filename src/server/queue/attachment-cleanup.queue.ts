import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface AttachmentCleanupJobData {
  gracePeriodHours: number;
}

export const attachmentCleanupQueue = new Queue<AttachmentCleanupJobData>(
  "attachment-cleanup",
  {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    },
  }
);

/**
 * Schedule daily cleanup job.
 * Call once at server startup.
 */
export async function scheduleAttachmentCleanup(): Promise<void> {
  // Remove any existing repeatable jobs first to prevent duplicates
  const existingJobs = await attachmentCleanupQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await attachmentCleanupQueue.removeRepeatableByKey(job.key);
  }

  // Schedule daily cleanup at 3 AM
  await attachmentCleanupQueue.add(
    "daily-cleanup",
    { gracePeriodHours: 24 }, // 24-hour grace period per user decision
    {
      repeat: {
        pattern: "0 3 * * *", // Cron: 3 AM daily
      },
    }
  );

  console.log("[AttachmentCleanup] Daily cleanup job scheduled for 3 AM");
}

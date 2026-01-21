/**
 * Status expiration worker processor.
 * Handles status-expiration jobs to auto-clear user statuses.
 *
 * STAT-03: Auto-clear status when expiration time is reached.
 */
import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userStatuses } from "@/db/schema";
import { getQueueConnection } from "@/server/queue/connection";
import type { StatusExpirationJobData } from "@/server/queue/status-expiration.queue";

/**
 * Process a status expiration job.
 * Clears the user's status if the jobId matches (prevents race condition).
 */
async function processStatusExpiration(
  job: Job<StatusExpirationJobData>
): Promise<{ success: boolean; skipped?: boolean }> {
  const { userId } = job.data;

  console.log(`[Status Expiration Worker] Processing status expiration for user ${userId}`);

  // Fetch current status
  const status = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, userId),
  });

  if (!status) {
    console.log(`[Status Expiration Worker] No status found for user ${userId}, skipping`);
    return { success: true, skipped: true };
  }

  // Critical: Check if jobId matches to prevent race condition
  // where old job clears a newly set status
  if (status.jobId !== job.id) {
    console.log(
      `[Status Expiration Worker] Job ID mismatch for user ${userId} (expected ${job.id}, found ${status.jobId}), skipping`
    );
    return { success: true, skipped: true };
  }

  // Delete the status record
  await db.delete(userStatuses).where(eq(userStatuses.userId, userId));

  console.log(`[Status Expiration Worker] Cleared status for user ${userId}`);
  return { success: true };
}

/**
 * Create and return the status expiration worker.
 * Handles status-expiration jobs with concurrency of 5.
 */
export function createStatusExpirationWorker(): Worker<StatusExpirationJobData> {
  const worker = new Worker<StatusExpirationJobData>(
    "status-expiration",
    async (job) => {
      return processStatusExpiration(job);
    },
    {
      connection: getQueueConnection(),
      concurrency: 5,
    }
  );

  // Error handling
  worker.on("failed", (job, error) => {
    console.error(`[Status Expiration Worker] Job ${job?.id} failed:`, error);
  });

  worker.on("completed", (job, result) => {
    if (result.skipped) {
      console.log(`[Status Expiration Worker] Job ${job.id} skipped`);
    } else {
      console.log(`[Status Expiration Worker] Job ${job.id} completed`);
    }
  });

  console.log("[Status Expiration Worker] Worker started");
  return worker;
}

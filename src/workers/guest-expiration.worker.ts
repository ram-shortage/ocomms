/**
 * Guest expiration worker processor.
 * Handles guest-expiration jobs to soft-lock expired guests.
 *
 * GUST-08: Auto soft-lock guest when expiration time is reached.
 * Soft lock means guest can view but not post (24-hour grace period approach).
 */
import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getQueueConnection } from "@/server/queue/connection";
import type { GuestExpirationJobData } from "@/server/queue/guest-expiration.queue";

/**
 * Process a guest expiration job.
 * Soft-locks the guest if the jobId matches (prevents race condition).
 */
async function processGuestExpiration(
  job: Job<GuestExpirationJobData>
): Promise<{ success: boolean; skipped?: boolean }> {
  const { memberId } = job.data;

  console.log(`[Guest Expiration Worker] Processing expiration for member ${memberId}`);

  // Fetch current member record
  const member = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  });

  if (!member) {
    console.log(`[Guest Expiration Worker] No member found for ${memberId}, skipping`);
    return { success: true, skipped: true };
  }

  // Verify this is a guest
  if (!member.isGuest) {
    console.log(`[Guest Expiration Worker] Member ${memberId} is not a guest, skipping`);
    return { success: true, skipped: true };
  }

  // Critical: Check if jobId matches to prevent race condition
  // where old job soft-locks after admin extended expiration
  if (member.guestJobId !== job.id) {
    console.log(
      `[Guest Expiration Worker] Job ID mismatch for member ${memberId} (expected ${job.id}, found ${member.guestJobId}), skipping`
    );
    return { success: true, skipped: true };
  }

  // Soft-lock the guest (can view but not post)
  await db
    .update(members)
    .set({ guestSoftLocked: true })
    .where(eq(members.id, memberId));

  console.log(`[Guest Expiration Worker] Soft-locked guest member ${memberId}`);
  return { success: true };
}

/**
 * Create and return the guest expiration worker.
 * Handles guest-expiration jobs with concurrency of 5.
 */
export function createGuestExpirationWorker(): Worker<GuestExpirationJobData> {
  const worker = new Worker<GuestExpirationJobData>(
    "guest-expiration",
    async (job) => {
      return processGuestExpiration(job);
    },
    {
      connection: getQueueConnection(),
      concurrency: 5,
    }
  );

  // Error handling
  worker.on("failed", (job, error) => {
    console.error(`[Guest Expiration Worker] Job ${job?.id} failed:`, error);
  });

  worker.on("completed", (job, result) => {
    if (result.skipped) {
      console.log(`[Guest Expiration Worker] Job ${job.id} skipped`);
    } else {
      console.log(`[Guest Expiration Worker] Job ${job.id} completed`);
    }
  });

  console.log("[Guest Expiration Worker] Worker started");
  return worker;
}

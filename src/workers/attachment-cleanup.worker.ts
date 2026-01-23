import { Worker } from "bullmq";
import { db } from "@/db";
import { fileAttachments } from "@/db/schema";
import { eq, lt, isNull, and } from "drizzle-orm";
import { getQueueConnection } from "@/server/queue/connection";
import { unlink } from "fs/promises";
import { join } from "path";
import type { AttachmentCleanupJobData } from "@/server/queue/attachment-cleanup.queue";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";

/**
 * Attachment Cleanup Worker
 *
 * Deletes orphaned attachments that are:
 * 1. Never attached to a message (messageId is NULL) AND older than grace period
 * 2. Attached to a message that was deleted AND older than grace period
 *
 * Grace period (24 hours) prevents deleting in-progress uploads.
 *
 * Note: Files attached to deleted messages are automatically removed via ON DELETE CASCADE.
 * This worker handles uploads that were never attached to any message.
 */
export function createAttachmentCleanupWorker(): Worker<AttachmentCleanupJobData> {
  const worker = new Worker<AttachmentCleanupJobData>(
    "attachment-cleanup",
    async (job) => {
      const { gracePeriodHours } = job.data;
      const cutoffDate = new Date(
        Date.now() - gracePeriodHours * 60 * 60 * 1000
      );

      console.log(`[AttachmentCleanup] Starting cleanup job ${job.id}`);
      console.log(
        `[AttachmentCleanup] Deleting orphans older than ${cutoffDate.toISOString()}`
      );

      // Find orphaned attachments:
      // messageId is NULL (never attached) AND older than grace period
      // Note: If message was deleted, CASCADE already removed the attachment record
      const orphaned = await db.query.fileAttachments.findMany({
        where: and(
          lt(fileAttachments.createdAt, cutoffDate),
          isNull(fileAttachments.messageId)
        ),
      });

      console.log(
        `[AttachmentCleanup] Found ${orphaned.length} orphaned attachments`
      );

      let deletedCount = 0;
      let errorCount = 0;

      for (const attachment of orphaned) {
        try {
          // Delete file from disk
          const filePath = join(
            process.cwd(),
            UPLOAD_DIR,
            "attachments",
            attachment.filename
          );
          await unlink(filePath).catch(() => {
            // File may already be deleted, continue
            console.log(
              `[AttachmentCleanup] File not found (already deleted?): ${attachment.filename}`
            );
          });

          // Delete database record
          await db
            .delete(fileAttachments)
            .where(eq(fileAttachments.id, attachment.id));

          console.log(
            `[AttachmentCleanup] Deleted: id=${attachment.id} file=${attachment.filename} size=${attachment.sizeBytes}`
          );
          deletedCount++;
        } catch (error) {
          console.error(
            `[AttachmentCleanup] Error deleting ${attachment.id}:`,
            error
          );
          errorCount++;
        }
      }

      console.log(
        `[AttachmentCleanup] Job ${job.id} complete: deleted=${deletedCount} errors=${errorCount}`
      );

      return { deletedCount, errorCount };
    },
    {
      connection: getQueueConnection(),
      concurrency: 1, // Only one cleanup job at a time
    }
  );

  console.log("[AttachmentCleanup] Worker started");
  return worker;
}

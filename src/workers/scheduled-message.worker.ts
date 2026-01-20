import { Worker } from "bullmq";
import { db } from "@/db";
import { scheduledMessages, messages, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getQueueConnection } from "@/server/queue/connection";
import { getEmitter } from "@/server/queue/emitter";
import type { ScheduledMessageJobData } from "@/server/queue/scheduled-message.queue";
import type { Message } from "@/lib/socket-events";

interface ProcessResult {
  success: boolean;
  messageId?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Broadcast a message to the appropriate room via Socket.IO Redis adapter.
 */
function broadcastMessage(
  message: Message,
  targetId: string,
  targetType: "channel" | "dm"
): void {
  const emitter = getEmitter();
  const room = targetType === "channel" ? `channel:${targetId}` : `dm:${targetId}`;

  emitter.to(room).emit("message:new", message);

  console.log(`[Worker] Broadcasted message ${message.id} to room ${room}`);
}

/**
 * Process a scheduled message: create the actual message and broadcast it.
 */
async function processScheduledMessage(
  scheduledMessageId: string
): Promise<ProcessResult> {
  // 1. Fetch scheduled message from DB
  const scheduled = await db.query.scheduledMessages.findFirst({
    where: eq(scheduledMessages.id, scheduledMessageId),
  });

  if (!scheduled) {
    console.log(`[Worker] Scheduled message ${scheduledMessageId} not found`);
    return { success: false, skipped: true, reason: "Not found" };
  }

  if (scheduled.status !== "pending") {
    console.log(`[Worker] Scheduled message ${scheduledMessageId} is not pending (status: ${scheduled.status})`);
    return { success: false, skipped: true, reason: "Not pending" };
  }

  // 2. Update status to processing
  await db
    .update(scheduledMessages)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(scheduledMessages.id, scheduledMessageId));

  try {
    // 3. Determine target
    const targetId = scheduled.channelId || scheduled.conversationId;
    const targetType: "channel" | "dm" = scheduled.channelId ? "channel" : "dm";

    if (!targetId) {
      throw new Error("No target ID (channelId or conversationId)");
    }

    // 4. Get next sequence number with retry for race condition handling
    const insertMessageWithRetry = async (retries = 3): Promise<typeof messages.$inferSelect> => {
      const condition = targetType === "channel"
        ? sql`channel_id = ${targetId}`
        : sql`conversation_id = ${targetId}`;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const [newMsg] = await db
            .insert(messages)
            .values({
              content: scheduled.content,
              authorId: scheduled.authorId,
              channelId: scheduled.channelId,
              conversationId: scheduled.conversationId,
              sequence: sql`(SELECT COALESCE(MAX(sequence), 0) + 1 FROM messages WHERE ${condition})`,
            })
            .returning();
          return newMsg;
        } catch (error: unknown) {
          const dbError = error as { code?: string };
          // PostgreSQL unique constraint violation - retry
          if (dbError.code === "23505" && attempt < retries - 1) {
            console.log(`[Worker] Sequence collision, retrying (attempt ${attempt + 1})`);
            continue;
          }
          throw error;
        }
      }
      throw new Error("Failed to insert message after retries");
    };

    const newMessage = await insertMessageWithRetry();

    // 5. Get author info for broadcast
    const [author] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, scheduled.authorId));

    // 6. Mark scheduled message as sent
    await db
      .update(scheduledMessages)
      .set({
        status: "sent",
        sentAt: new Date(),
        messageId: newMessage.id,
        updatedAt: new Date(),
      })
      .where(eq(scheduledMessages.id, scheduledMessageId));

    // 7. Prepare message for broadcast
    const messageWithAuthor: Message = {
      id: newMessage.id,
      content: newMessage.content,
      authorId: newMessage.authorId,
      channelId: newMessage.channelId,
      conversationId: newMessage.conversationId,
      sequence: newMessage.sequence,
      deletedAt: newMessage.deletedAt,
      createdAt: newMessage.createdAt,
      updatedAt: newMessage.updatedAt,
      author: author ? { id: author.id, name: author.name, email: author.email } : undefined,
    };

    // 8. Broadcast via Socket.IO Redis adapter
    broadcastMessage(messageWithAuthor, targetId, targetType);

    console.log(`[Worker] Successfully sent scheduled message ${scheduledMessageId} as message ${newMessage.id}`);

    return { success: true, messageId: newMessage.id };
  } catch (error) {
    // Mark as failed
    await db
      .update(scheduledMessages)
      .set({
        status: "failed",
        error: String(error),
        updatedAt: new Date(),
      })
      .where(eq(scheduledMessages.id, scheduledMessageId));

    console.error(`[Worker] Failed to send scheduled message ${scheduledMessageId}:`, error);

    // Re-throw for BullMQ retry mechanism
    throw error;
  }
}

/**
 * Create and return the scheduled message worker.
 * Worker processes delayed jobs from the scheduled-messages queue.
 */
export function createScheduledMessageWorker(): Worker<ScheduledMessageJobData> {
  return new Worker<ScheduledMessageJobData>(
    "scheduled-messages",
    async (job) => {
      console.log(`[Worker] Processing job ${job.id} for scheduled message ${job.data.scheduledMessageId}`);
      return processScheduledMessage(job.data.scheduledMessageId);
    },
    {
      connection: getQueueConnection(),
      concurrency: 5,
    }
  );
}

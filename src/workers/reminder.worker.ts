/**
 * Reminder worker processor.
 * Handles one-time-reminder, recurring-reminder, and snoozed-reminder jobs.
 *
 * RMND-*: Fires reminders at scheduled time with Socket.IO event and push notification.
 */
import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import { getQueueConnection } from "@/server/queue/connection";
import { getEmitter } from "@/server/queue/emitter";
import { sendPushToUser, isUserDndEnabled, type PushPayload } from "@/lib/push/send";
import type { ReminderJobData } from "@/server/queue/reminder.queue";
import type { Reminder as ReminderSocketType, Message } from "@/lib/socket-events";

// Room naming helper (matches server/socket/rooms.ts)
const getRoomName = {
  user: (userId: string) => `user:${userId}`,
};

/**
 * Process a reminder job (one-time, recurring, or snoozed).
 * Updates status to "fired", emits Socket.IO event, sends push notification.
 */
async function processReminderJob(job: Job<ReminderJobData>): Promise<{ success: boolean; skipped?: boolean }> {
  const { reminderId } = job.data;

  console.log(`[Reminder Worker] Processing reminder ${reminderId}`);

  // Fetch reminder with message and author
  const reminder = await db.query.reminders.findFirst({
    where: eq(reminders.id, reminderId),
    with: {
      message: {
        with: {
          author: true,
        },
      },
    },
  });

  if (!reminder) {
    console.log(`[Reminder Worker] Reminder ${reminderId} not found, skipping`);
    return { success: true, skipped: true };
  }

  // Skip if already completed or cancelled
  if (reminder.status === "completed" || reminder.status === "cancelled") {
    console.log(`[Reminder Worker] Reminder ${reminderId} is ${reminder.status}, skipping`);
    return { success: true, skipped: true };
  }

  // Update status to "fired"
  await db.update(reminders)
    .set({
      status: "fired",
      lastFiredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reminders.id, reminderId));

  // Format message data for Socket.IO event
  const messageData: Message = {
    id: reminder.message.id,
    content: reminder.message.content,
    authorId: reminder.message.authorId,
    author: reminder.message.author ? {
      id: reminder.message.author.id,
      name: reminder.message.author.name,
      email: reminder.message.author.email,
    } : undefined,
    channelId: reminder.message.channelId,
    conversationId: reminder.message.conversationId,
    parentId: reminder.message.parentId,
    sequence: reminder.message.sequence,
    createdAt: reminder.message.createdAt,
    updatedAt: reminder.message.updatedAt,
  };

  // Format reminder data for Socket.IO event
  const reminderData: ReminderSocketType = {
    id: reminder.id,
    messageId: reminder.messageId,
    note: reminder.note,
    remindAt: reminder.remindAt,
    status: "fired",
    recurringPattern: reminder.recurringPattern,
  };

  // Check DND status before sending real-time notifications (STAT-06)
  // Note: Reminder status is already updated to "fired" above - this only affects real-time delivery
  const isDnd = await isUserDndEnabled(reminder.userId);
  if (isDnd) {
    console.log(`[Reminder Worker] User ${reminder.userId} has DND enabled, skipping real-time notification`);
    console.log(`[Reminder Worker] Successfully fired reminder ${reminderId} (DND blocked notification)`);
    return { success: true };
  }

  // Emit Socket.IO event to user's personal room
  try {
    const emitter = getEmitter();
    emitter.to(getRoomName.user(reminder.userId)).emit("reminder:fired", {
      reminder: reminderData,
      message: messageData,
    });
    console.log(`[Reminder Worker] Emitted reminder:fired to user ${reminder.userId}`);
  } catch (error) {
    console.error(`[Reminder Worker] Failed to emit Socket.IO event:`, error);
    // Continue with push notification even if Socket.IO fails
  }

  // Send push notification
  try {
    const messagePreview = reminder.message.content.slice(0, 50);
    const bodyText = reminder.note || `Reminder: ${messagePreview}${reminder.message.content.length > 50 ? "..." : ""}`;

    const pushPayload: PushPayload = {
      title: "Reminder",
      body: bodyText,
      data: {
        url: "/", // User can navigate from the app
        tag: `reminder:${reminder.id}`,
        type: "mention", // Reuse existing type for push infrastructure
        messageId: reminder.messageId,
      },
    };

    const result = await sendPushToUser(reminder.userId, pushPayload);
    console.log(`[Reminder Worker] Push sent to user ${reminder.userId}: ${result.sent} sent, ${result.failed} failed`);
  } catch (error) {
    console.error(`[Reminder Worker] Failed to send push notification:`, error);
    // Don't fail the job for push notification failure
  }

  console.log(`[Reminder Worker] Successfully fired reminder ${reminderId}`);
  return { success: true };
}

/**
 * Create and return the reminder worker.
 * Handles all reminder job types: one-time-reminder, recurring-reminder, snoozed-reminder.
 */
export function createReminderWorker(): Worker<ReminderJobData> {
  const worker = new Worker<ReminderJobData>(
    "reminders",
    async (job) => {
      return processReminderJob(job);
    },
    {
      connection: getQueueConnection(),
      concurrency: 5,
    }
  );

  // Error handling
  worker.on("failed", (job, error) => {
    console.error(`[Reminder Worker] Job ${job?.id} failed:`, error);
  });

  worker.on("completed", (job, result) => {
    if (result.skipped) {
      console.log(`[Reminder Worker] Job ${job.id} skipped`);
    } else {
      console.log(`[Reminder Worker] Job ${job.id} completed`);
    }
  });

  console.log("[Reminder Worker] Worker started");
  return worker;
}

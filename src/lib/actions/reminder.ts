"use server";

import { db } from "@/db";
import { reminders, messages, channelMembers, conversationParticipants, channels } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { reminderQueue } from "@/server/queue/reminder.queue";
import { addMinutes, addHours, addDays, setHours, setMinutes, setSeconds } from "date-fns";

type ReminderStatus = "pending" | "fired" | "snoozed" | "completed" | "cancelled";
type RecurringPattern = "daily" | "weekly" | null;
type SnoozeDuration = "20min" | "1hour" | "3hours" | "tomorrow";

interface CreateReminderData {
  messageId: string;
  remindAt: Date;
  note?: string;
  recurringPattern?: "daily" | "weekly";
}

/**
 * Verify user has access to a message (via channel membership or DM participation)
 */
async function verifyMessageAccess(userId: string, messageId: string): Promise<boolean> {
  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  });

  if (!message) return false;

  // Check channel membership
  if (message.channelId) {
    const membership = await db.query.channelMembers.findFirst({
      where: and(
        eq(channelMembers.channelId, message.channelId),
        eq(channelMembers.userId, userId)
      ),
    });
    return !!membership;
  }

  // Check DM participation
  if (message.conversationId) {
    const participation = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, message.conversationId),
        eq(conversationParticipants.userId, userId)
      ),
    });
    return !!participation;
  }

  return false;
}

/**
 * Create a reminder on a message
 * RMND-01: Set reminder on any message via action menu
 * RMND-02: Set reminder for specific date and time
 * RMND-07: Recurring reminders (daily, weekly)
 */
export async function createReminder(data: CreateReminderData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const { messageId, remindAt, note, recurringPattern } = data;

  // Verify message exists and user has access
  const hasAccess = await verifyMessageAccess(session.user.id, messageId);
  if (!hasAccess) {
    throw new Error("Message not found or access denied");
  }

  // Validate remindAt is in future
  if (remindAt.getTime() <= Date.now()) {
    throw new Error("Reminder time must be in the future");
  }

  // Insert reminder with status "pending"
  const [reminder] = await db.insert(reminders).values({
    userId: session.user.id,
    messageId,
    note: note || null,
    remindAt,
    status: "pending",
    recurringPattern: recurringPattern || null,
  }).returning();

  // Schedule the job
  const jobId = `reminder-${reminder.id}`;

  if (recurringPattern) {
    // RMND-07: Recurring reminders
    const intervalMs = recurringPattern === "daily"
      ? 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

    await reminderQueue.upsertJobScheduler(
      jobId,
      {
        every: intervalMs,
        startDate: remindAt,
      },
      {
        name: "recurring-reminder",
        data: { reminderId: reminder.id },
      }
    );
  } else {
    // One-time reminder
    const delay = remindAt.getTime() - Date.now();
    await reminderQueue.add(
      "one-time-reminder",
      { reminderId: reminder.id },
      { delay, jobId }
    );
  }

  // Update reminder with jobId
  await db.update(reminders)
    .set({ jobId, updatedAt: new Date() })
    .where(eq(reminders.id, reminder.id));

  revalidatePath("/");
  return { ...reminder, jobId };
}

/**
 * Get all reminders for the current user
 * RMND-03: View list of pending reminders in sidebar
 * Includes channel slug for navigation
 */
export async function getReminders(includeCompleted = false) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const statusFilter = includeCompleted
    ? (["pending", "fired", "snoozed", "completed"] as const)
    : (["pending", "fired", "snoozed"] as const);

  const userReminders = await db.query.reminders.findMany({
    where: and(
      eq(reminders.userId, session.user.id),
      inArray(reminders.status, statusFilter)
    ),
    with: {
      message: {
        with: {
          author: true,
          channel: {
            columns: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: (reminders, { asc }) => [asc(reminders.remindAt)],
  });

  return userReminders;
}

/**
 * Get a single reminder by ID
 */
export async function getReminder(id: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const reminder = await db.query.reminders.findFirst({
    where: and(
      eq(reminders.id, id),
      eq(reminders.userId, session.user.id)
    ),
    with: {
      message: {
        with: {
          author: true,
        },
      },
    },
  });

  return reminder;
}

/**
 * Snooze a fired reminder
 * RMND-05: Snooze reminder (20min, 1hr, 3hr, tomorrow)
 */
export async function snoozeReminder(id: string, snoozeDuration: SnoozeDuration) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify ownership
  const reminder = await db.query.reminders.findFirst({
    where: and(
      eq(reminders.id, id),
      eq(reminders.userId, session.user.id)
    ),
  });

  if (!reminder) {
    throw new Error("Reminder not found");
  }

  // Calculate snoozedUntil based on duration
  const now = new Date();
  let snoozedUntil: Date;

  switch (snoozeDuration) {
    case "20min":
      snoozedUntil = addMinutes(now, 20);
      break;
    case "1hour":
      snoozedUntil = addHours(now, 1);
      break;
    case "3hours":
      snoozedUntil = addHours(now, 3);
      break;
    case "tomorrow":
      // Tomorrow at 9am
      snoozedUntil = setSeconds(setMinutes(setHours(addDays(now, 1), 9), 0), 0);
      break;
  }

  // Remove old job if exists
  if (reminder.jobId) {
    try {
      const job = await reminderQueue.getJob(reminder.jobId);
      if (job) await job.remove();
    } catch (error) {
      console.error("[Reminder] Failed to remove old job:", error);
    }
  }

  // Add new delayed job
  const newJobId = `reminder-${id}-snoozed-${Date.now()}`;
  const delay = snoozedUntil.getTime() - Date.now();
  await reminderQueue.add(
    "snoozed-reminder",
    { reminderId: id },
    { delay, jobId: newJobId }
  );

  // Update status to snoozed
  const [updated] = await db.update(reminders)
    .set({
      status: "snoozed",
      snoozedUntil,
      jobId: newJobId,
      updatedAt: new Date(),
    })
    .where(eq(reminders.id, id))
    .returning();

  revalidatePath("/");
  return updated;
}

/**
 * Mark a reminder as complete
 * RMND-04: Mark reminder as complete
 */
export async function completeReminder(id: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify ownership
  const reminder = await db.query.reminders.findFirst({
    where: and(
      eq(reminders.id, id),
      eq(reminders.userId, session.user.id)
    ),
  });

  if (!reminder) {
    throw new Error("Reminder not found");
  }

  // Remove job/scheduler if exists
  if (reminder.jobId) {
    try {
      // Try removing as regular job first
      const job = await reminderQueue.getJob(reminder.jobId);
      if (job) await job.remove();

      // For recurring, also try removing the scheduler
      if (reminder.recurringPattern) {
        await reminderQueue.removeJobScheduler(reminder.jobId);
      }
    } catch (error) {
      console.error("[Reminder] Failed to remove job:", error);
    }
  }

  // Update status to completed
  const [updated] = await db.update(reminders)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reminders.id, id))
    .returning();

  revalidatePath("/");
  return updated;
}

/**
 * Get message IDs that have active reminders for the current user
 * Used to highlight reminder bells on messages in the message list
 */
export async function getMessageIdsWithReminders(): Promise<string[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const activeReminders = await db.query.reminders.findMany({
    where: and(
      eq(reminders.userId, session.user.id),
      inArray(reminders.status, ["pending", "fired", "snoozed"])
    ),
    columns: {
      messageId: true,
    },
  });

  return activeReminders.map((r) => r.messageId);
}

/**
 * Cancel a reminder
 */
export async function cancelReminder(id: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify ownership
  const reminder = await db.query.reminders.findFirst({
    where: and(
      eq(reminders.id, id),
      eq(reminders.userId, session.user.id)
    ),
  });

  if (!reminder) {
    throw new Error("Reminder not found");
  }

  // Remove job/scheduler if exists
  if (reminder.jobId) {
    try {
      const job = await reminderQueue.getJob(reminder.jobId);
      if (job) await job.remove();

      if (reminder.recurringPattern) {
        await reminderQueue.removeJobScheduler(reminder.jobId);
      }
    } catch (error) {
      console.error("[Reminder] Failed to remove job:", error);
    }
  }

  // Update status to cancelled
  const [updated] = await db.update(reminders)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(reminders.id, id))
    .returning();

  revalidatePath("/");
  return updated;
}

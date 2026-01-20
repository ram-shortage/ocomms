"use server";

import { db } from "@/db";
import { scheduledMessages, channelMembers, conversationParticipants, channels, conversations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";
import { scheduledMessageQueue } from "@/server/queue/scheduled-message.queue";
import { revalidatePath } from "next/cache";

/**
 * Create a scheduled message for future delivery.
 * Message can target either a channel or a DM conversation.
 */
export async function createScheduledMessage(data: {
  content: string;
  scheduledFor: Date;
  channelId?: string;
  conversationId?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const { content, scheduledFor, channelId, conversationId } = data;

  // Validate content
  if (!content.trim()) {
    throw new Error("Message content cannot be empty");
  }

  // Validate scheduledFor is in the future
  if (scheduledFor <= new Date()) {
    throw new Error("Scheduled time must be in the future");
  }

  // Validate exactly one target is provided
  if ((!channelId && !conversationId) || (channelId && conversationId)) {
    throw new Error("Must provide exactly one of channelId or conversationId");
  }

  // Verify membership in target
  if (channelId) {
    const membership = await db.query.channelMembers.findFirst({
      where: and(
        eq(channelMembers.channelId, channelId),
        eq(channelMembers.userId, session.user.id)
      ),
    });
    if (!membership) {
      throw new Error("Not a member of this channel");
    }

    // Check channel is not archived
    const channel = await db.query.channels.findFirst({
      where: eq(channels.id, channelId),
    });
    if (channel?.isArchived) {
      throw new Error("Cannot schedule messages to archived channels");
    }
  } else if (conversationId) {
    const participation = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, session.user.id)
      ),
    });
    if (!participation) {
      throw new Error("Not a participant in this conversation");
    }
  }

  // Insert into database with pending status
  const [scheduled] = await db
    .insert(scheduledMessages)
    .values({
      authorId: session.user.id,
      content: content.trim(),
      channelId: channelId || null,
      conversationId: conversationId || null,
      scheduledFor,
      status: "pending",
    })
    .returning();

  // Add delayed job to BullMQ
  const delay = scheduledFor.getTime() - Date.now();
  const job = await scheduledMessageQueue.add(
    "send",
    { scheduledMessageId: scheduled.id },
    { delay, jobId: `scheduled-${scheduled.id}` }
  );

  // Update record with job ID
  await db
    .update(scheduledMessages)
    .set({ jobId: job.id })
    .where(eq(scheduledMessages.id, scheduled.id));

  revalidatePath("/");
  return { ...scheduled, jobId: job.id };
}

/**
 * Get all pending scheduled messages for the current user.
 */
export async function getScheduledMessages() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const messages = await db.query.scheduledMessages.findMany({
    where: and(
      eq(scheduledMessages.authorId, session.user.id),
      eq(scheduledMessages.status, "pending")
    ),
    orderBy: [scheduledMessages.scheduledFor],
    with: {
      channel: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
      conversation: {
        columns: {
          id: true,
        },
        with: {
          participants: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return messages;
}

/**
 * Update a scheduled message's content and/or scheduled time.
 */
export async function updateScheduledMessage(
  id: string,
  data: {
    content?: string;
    scheduledFor?: Date;
  }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify ownership and status
  const existing = await db.query.scheduledMessages.findFirst({
    where: eq(scheduledMessages.id, id),
  });

  if (!existing) {
    throw new Error("Scheduled message not found");
  }

  if (existing.authorId !== session.user.id) {
    throw new Error("Not authorized to update this scheduled message");
  }

  if (existing.status !== "pending") {
    throw new Error("Cannot update a scheduled message that is no longer pending");
  }

  // Validate new content if provided
  if (data.content !== undefined && !data.content.trim()) {
    throw new Error("Message content cannot be empty");
  }

  // Validate new scheduledFor if provided
  if (data.scheduledFor !== undefined && data.scheduledFor <= new Date()) {
    throw new Error("Scheduled time must be in the future");
  }

  // Prepare update values
  const updateValues: Partial<typeof scheduledMessages.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.content !== undefined) {
    updateValues.content = data.content.trim();
  }

  let newJobId = existing.jobId;

  if (data.scheduledFor !== undefined) {
    updateValues.scheduledFor = data.scheduledFor;

    // If scheduledFor changed, reschedule the job
    if (existing.jobId) {
      // Remove old job
      const oldJob = await scheduledMessageQueue.getJob(existing.jobId);
      if (oldJob) {
        await oldJob.remove();
      }
    }

    // Add new job with updated delay
    const delay = data.scheduledFor.getTime() - Date.now();
    const job = await scheduledMessageQueue.add(
      "send",
      { scheduledMessageId: id },
      { delay, jobId: `scheduled-${id}-${Date.now()}` }
    );
    newJobId = job.id ?? null;
    updateValues.jobId = newJobId;
  }

  // Update record
  const [updated] = await db
    .update(scheduledMessages)
    .set(updateValues)
    .where(eq(scheduledMessages.id, id))
    .returning();

  revalidatePath("/");
  return updated;
}

/**
 * Cancel a scheduled message.
 */
export async function cancelScheduledMessage(id: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify ownership and status
  const existing = await db.query.scheduledMessages.findFirst({
    where: eq(scheduledMessages.id, id),
  });

  if (!existing) {
    throw new Error("Scheduled message not found");
  }

  if (existing.authorId !== session.user.id) {
    throw new Error("Not authorized to cancel this scheduled message");
  }

  if (existing.status !== "pending") {
    throw new Error("Cannot cancel a scheduled message that is no longer pending");
  }

  // Remove job from queue
  if (existing.jobId) {
    const job = await scheduledMessageQueue.getJob(existing.jobId);
    if (job) {
      await job.remove();
    }
  }

  // Update status to cancelled
  await db
    .update(scheduledMessages)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(scheduledMessages.id, id));

  revalidatePath("/");
  return { success: true };
}

/**
 * Send a scheduled message immediately (bypass the scheduled time).
 */
export async function sendScheduledMessageNow(id: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify ownership and status
  const existing = await db.query.scheduledMessages.findFirst({
    where: eq(scheduledMessages.id, id),
  });

  if (!existing) {
    throw new Error("Scheduled message not found");
  }

  if (existing.authorId !== session.user.id) {
    throw new Error("Not authorized to send this scheduled message");
  }

  if (existing.status !== "pending") {
    throw new Error("Cannot send a scheduled message that is no longer pending");
  }

  // Remove the delayed job
  if (existing.jobId) {
    const job = await scheduledMessageQueue.getJob(existing.jobId);
    if (job) {
      await job.remove();
    }
  }

  // Add immediate job (no delay)
  const job = await scheduledMessageQueue.add(
    "send",
    { scheduledMessageId: id },
    { jobId: `scheduled-${id}-now-${Date.now()}` }
  );

  // Update job ID in record
  await db
    .update(scheduledMessages)
    .set({ jobId: job.id, updatedAt: new Date() })
    .where(eq(scheduledMessages.id, id));

  revalidatePath("/");
  return { success: true };
}

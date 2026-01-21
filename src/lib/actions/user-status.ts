"use server";

import { db } from "@/db";
import { userStatuses, members } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { statusExpirationQueue } from "@/server/queue/status-expiration.queue";

interface SetUserStatusInput {
  emoji?: string;
  text?: string;
  expiresAt?: Date;
  dndEnabled?: boolean;
}

/**
 * Set or update the current user's status
 * STAT-01: Custom status with emoji and text
 * STAT-03: Status expiration scheduling
 * STAT-06: DND toggle
 */
export async function setUserStatus(input: SetUserStatusInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const { emoji, text, expiresAt, dndEnabled } = input;

  // Validate text length (STAT-01)
  if (text && text.length > 100) {
    throw new Error("Status text must be 100 characters or less");
  }

  // Get existing status to find old jobId
  const existing = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, session.user.id),
  });

  // Cancel old expiration job if exists
  if (existing?.jobId) {
    try {
      const job = await statusExpirationQueue.getJob(existing.jobId);
      if (job) await job.remove();
    } catch (error) {
      console.error("[UserStatus] Failed to remove old job:", error);
    }
  }

  // Prepare new jobId if expiration is set
  let newJobId: string | null = null;

  if (expiresAt && expiresAt.getTime() > Date.now()) {
    const delay = expiresAt.getTime() - Date.now();
    newJobId = `status-${session.user.id}-${Date.now()}`;

    await statusExpirationQueue.add(
      "status-expiration",
      { userId: session.user.id },
      { delay, jobId: newJobId }
    );
  }

  // Upsert status (insert or update on conflict)
  if (existing) {
    // Update existing status
    const [updated] = await db
      .update(userStatuses)
      .set({
        emoji: emoji ?? null,
        text: text ?? null,
        expiresAt: expiresAt ?? null,
        dndEnabled: dndEnabled ?? false,
        jobId: newJobId,
        updatedAt: new Date(),
      })
      .where(eq(userStatuses.userId, session.user.id))
      .returning();

    revalidatePath("/");
    return updated;
  } else {
    // Insert new status
    const [created] = await db
      .insert(userStatuses)
      .values({
        userId: session.user.id,
        emoji: emoji ?? null,
        text: text ?? null,
        expiresAt: expiresAt ?? null,
        dndEnabled: dndEnabled ?? false,
        jobId: newJobId,
      })
      .returning();

    revalidatePath("/");
    return created;
  }
}

/**
 * Clear the current user's status
 * STAT-05: Clear status manually
 */
export async function clearUserStatus() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get existing status
  const existing = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, session.user.id),
  });

  if (!existing) {
    return { cleared: true };
  }

  // Cancel expiration job if exists
  if (existing.jobId) {
    try {
      const job = await statusExpirationQueue.getJob(existing.jobId);
      if (job) await job.remove();
    } catch (error) {
      console.error("[UserStatus] Failed to remove job:", error);
    }
  }

  // Delete status record
  await db.delete(userStatuses).where(eq(userStatuses.userId, session.user.id));

  revalidatePath("/");
  return { cleared: true };
}

/**
 * Get a user's status by ID
 * M-8 FIX: Requires authentication and org scoping
 */
export async function getUserStatus(userId: string, organizationId?: string) {
  // Require authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // If organizationId provided, verify requester is also a member
  if (organizationId) {
    const requesterMembership = await db.query.members.findFirst({
      where: and(
        eq(members.organizationId, organizationId),
        eq(members.userId, session.user.id)
      ),
    });
    if (!requesterMembership) {
      throw new Error("Not authorized to view user status in this organization");
    }

    // Also verify target user is in the same organization
    const targetMembership = await db.query.members.findFirst({
      where: and(
        eq(members.organizationId, organizationId),
        eq(members.userId, userId)
      ),
    });
    if (!targetMembership) {
      return null; // User not in this org, return nothing
    }
  } else {
    // Without organizationId, only allow self-lookup
    if (session.user.id !== userId) {
      throw new Error("Organization context required for cross-user status lookup");
    }
  }

  const status = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, userId),
  });

  return status ?? null;
}

/**
 * Get the current user's status
 */
export async function getMyStatus() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const status = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, session.user.id),
  });

  return status ?? null;
}

/**
 * Check if a user has DND enabled
 * Used by push notification sender (STAT-06)
 */
export async function isUserDndEnabled(userId: string): Promise<boolean> {
  const status = await db.query.userStatuses.findFirst({
    where: eq(userStatuses.userId, userId),
    columns: {
      dndEnabled: true,
    },
  });

  return status?.dndEnabled ?? false;
}

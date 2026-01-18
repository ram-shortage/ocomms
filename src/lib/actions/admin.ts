"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userLockout, members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

export async function adminUnlockUser(userId: string, organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Verify caller is admin/owner in the same organization as target user
  const callerMembership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, organizationId)
    ),
  });

  if (!callerMembership || (callerMembership.role !== "owner" && callerMembership.role !== "admin")) {
    throw new Error("Only admins can unlock accounts");
  }

  // Verify target user is in the same organization
  const targetMembership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });

  if (!targetMembership) {
    throw new Error("User not in organization");
  }

  // Clear lockout (keep lockoutCount for escalation history)
  await db.update(userLockout)
    .set({
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userLockout.userId, userId));

  return { success: true };
}

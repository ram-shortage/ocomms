"use server";

import { db } from "@/db";
import { members, guestInvites, guestChannelAccess, channels } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { guestExpirationQueue } from "@/server/queue/guest-expiration.queue";

/**
 * Verify user is admin/owner in the organization
 */
async function verifyAdminAccess(userId: string, organizationId: string): Promise<boolean> {
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });
  return membership?.role === "admin" || membership?.role === "owner";
}

/**
 * GUST-01, GUST-02, GUST-08: Create a guest invite link for specific channels
 * Admin generates a shareable link that grants access to specified channels
 */
export async function createGuestInvite(
  organizationId: string,
  channelIds: string[],
  expiresAt?: Date
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can create guest invites");
  }

  // Validate channels exist and belong to organization
  if (channelIds.length === 0) {
    throw new Error("At least one channel must be specified");
  }

  const validChannels = await db.query.channels.findMany({
    where: and(
      inArray(channels.id, channelIds),
      eq(channels.organizationId, organizationId)
    ),
  });

  if (validChannels.length !== channelIds.length) {
    throw new Error("One or more channels are invalid or do not belong to this workspace");
  }

  // Generate unique token
  const token = nanoid(21);

  // Create invite record
  const [invite] = await db
    .insert(guestInvites)
    .values({
      organizationId,
      token,
      createdBy: session.user.id,
      expiresAt: expiresAt ?? null,
      channelIds: JSON.stringify(channelIds),
    })
    .returning();

  revalidatePath("/");

  return {
    id: invite.id,
    token: invite.token,
    inviteUrl: `/join/${token}`,
    expiresAt: invite.expiresAt,
    channelIds,
  };
}

/**
 * Redeem a guest invite link
 * Called when someone visits the invite link
 */
export async function redeemGuestInvite(token: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized - Please sign in first");

  // Find invite by token
  const invite = await db.query.guestInvites.findFirst({
    where: eq(guestInvites.token, token),
    with: {
      organization: true,
    },
  });

  if (!invite) {
    throw new Error("Invalid invite link");
  }

  // Check if already used
  if (invite.usedBy) {
    throw new Error("This invite link has already been used");
  }

  // Check if invite has expired (not guest expiration, just invite validity)
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("This invite link has expired");
  }

  // Check if user is already a member of this organization
  const existingMembership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, invite.organizationId)
    ),
  });

  if (existingMembership) {
    throw new Error("You are already a member of this workspace");
  }

  // Parse allowed channel IDs
  const channelIds: string[] = JSON.parse(invite.channelIds);

  // Calculate guest expiration (30 days from now if invite has expiration, otherwise no expiration)
  // Note: The guest expiration is separate from invite expiration
  // Using invite.expiresAt as guest expiration baseline if set
  const guestExpiresAt = invite.expiresAt ? new Date(invite.expiresAt) : null;

  // Create member record with isGuest=true in a transaction
  const memberId = nanoid();
  let guestJobId: string | null = null;

  // Schedule expiration job if guestExpiresAt is set
  if (guestExpiresAt && guestExpiresAt.getTime() > Date.now()) {
    // Add 24-hour grace period for soft lock
    const softLockTime = new Date(guestExpiresAt.getTime());
    const delay = softLockTime.getTime() - Date.now();
    guestJobId = `guest-${memberId}-${Date.now()}`;

    await guestExpirationQueue.add(
      "guest-expiration",
      { memberId },
      { delay, jobId: guestJobId }
    );
  }

  await db.transaction(async (tx) => {
    // Create guest member record
    await tx.insert(members).values({
      id: memberId,
      userId: session.user.id,
      organizationId: invite.organizationId,
      role: "member",
      isGuest: true,
      guestExpiresAt,
      guestSoftLocked: false,
      guestJobId,
    });

    // Create guestChannelAccess records for each allowed channel
    if (channelIds.length > 0) {
      await tx.insert(guestChannelAccess).values(
        channelIds.map((channelId) => ({
          memberId,
          channelId,
        }))
      );
    }

    // Mark invite as used
    await tx
      .update(guestInvites)
      .set({
        usedBy: session.user.id,
        usedAt: new Date(),
      })
      .where(eq(guestInvites.id, invite.id));
  });

  revalidatePath("/");

  return {
    success: true,
    organizationSlug: invite.organization?.slug,
    organizationId: invite.organizationId,
  };
}

/**
 * GUST-05: Remove guest access from workspace
 * Admin removes a guest entirely
 */
export async function removeGuestAccess(memberId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get the member record
  const memberRecord = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  });

  if (!memberRecord) {
    throw new Error("Guest not found");
  }

  if (!memberRecord.isGuest) {
    throw new Error("This member is not a guest");
  }

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, memberRecord.organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can remove guest access");
  }

  // Cancel pending expiration job if exists
  if (memberRecord.guestJobId) {
    try {
      const job = await guestExpirationQueue.getJob(memberRecord.guestJobId);
      if (job) await job.remove();
    } catch (error) {
      console.error("[Guest] Failed to remove expiration job:", error);
    }
  }

  // Delete guest channel access records and member record
  await db.transaction(async (tx) => {
    await tx
      .delete(guestChannelAccess)
      .where(eq(guestChannelAccess.memberId, memberId));

    await tx.delete(members).where(eq(members.id, memberId));
  });

  revalidatePath("/");

  return { success: true };
}

/**
 * Extend or clear guest expiration
 * Admin can extend expiration date or clear it entirely
 */
export async function extendGuestExpiration(
  memberId: string,
  newExpiresAt: Date | null
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get the member record
  const memberRecord = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  });

  if (!memberRecord) {
    throw new Error("Guest not found");
  }

  if (!memberRecord.isGuest) {
    throw new Error("This member is not a guest");
  }

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, memberRecord.organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can modify guest expiration");
  }

  // Cancel old expiration job if exists
  if (memberRecord.guestJobId) {
    try {
      const job = await guestExpirationQueue.getJob(memberRecord.guestJobId);
      if (job) await job.remove();
    } catch (error) {
      console.error("[Guest] Failed to remove old expiration job:", error);
    }
  }

  // Schedule new job if newExpiresAt provided
  let newJobId: string | null = null;

  if (newExpiresAt && newExpiresAt.getTime() > Date.now()) {
    const delay = newExpiresAt.getTime() - Date.now();
    newJobId = `guest-${memberId}-${Date.now()}`;

    await guestExpirationQueue.add(
      "guest-expiration",
      { memberId },
      { delay, jobId: newJobId }
    );
  }

  // Update member record - clear soft lock if was locked
  await db
    .update(members)
    .set({
      guestExpiresAt: newExpiresAt,
      guestSoftLocked: false, // Clear soft lock when admin extends
      guestJobId: newJobId,
    })
    .where(eq(members.id, memberId));

  revalidatePath("/");

  return { success: true, newExpiresAt };
}

/**
 * Get all guest invites for a workspace
 * Admin: list all invites with usage status
 */
export async function getGuestInvites(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can view guest invites");
  }

  const invites = await db.query.guestInvites.findMany({
    where: eq(guestInvites.organizationId, organizationId),
    with: {
      creator: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      usedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: (invites, { desc }) => [desc(invites.createdAt)],
  });

  return invites.map((invite) => ({
    id: invite.id,
    token: invite.token,
    inviteUrl: `/join/${invite.token}`,
    channelIds: JSON.parse(invite.channelIds) as string[],
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    createdBy: invite.creator,
    usedBy: invite.usedByUser,
    usedAt: invite.usedAt,
    isUsed: !!invite.usedBy,
    isExpired: invite.expiresAt ? invite.expiresAt < new Date() : false,
  }));
}

/**
 * Get channels a guest has access to
 * Used for authorization checks
 */
export async function getGuestChannelAccess(memberId: string) {
  const accessRecords = await db.query.guestChannelAccess.findMany({
    where: eq(guestChannelAccess.memberId, memberId),
    with: {
      channel: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return accessRecords.map((record) => record.channel);
}

/**
 * Get all guests in a workspace
 * Admin: list all guests with their allowed channels and expiration status
 */
export async function getWorkspaceGuests(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can view workspace guests");
  }

  // Get all guest members in the organization
  const guestMembers = await db.query.members.findMany({
    where: and(
      eq(members.organizationId, organizationId),
      eq(members.isGuest, true)
    ),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  // For each guest, get their channel access
  const guestsWithAccess = await Promise.all(
    guestMembers.map(async (guest) => {
      const channelAccess = await getGuestChannelAccess(guest.id);
      return {
        id: guest.id,
        user: guest.user,
        createdAt: guest.createdAt,
        guestExpiresAt: guest.guestExpiresAt,
        guestSoftLocked: guest.guestSoftLocked,
        channels: channelAccess,
        isExpired: guest.guestExpiresAt ? guest.guestExpiresAt < new Date() : false,
      };
    })
  );

  return guestsWithAccess;
}

/**
 * Check if a member is a guest with access to a specific channel
 * Used for authorization checks in channel access
 */
export async function verifyGuestChannelAccess(
  memberId: string,
  channelId: string
): Promise<boolean> {
  const access = await db.query.guestChannelAccess.findFirst({
    where: and(
      eq(guestChannelAccess.memberId, memberId),
      eq(guestChannelAccess.channelId, channelId)
    ),
  });
  return !!access;
}

/**
 * Check if a guest is soft-locked (expired but in grace period)
 */
export async function isGuestSoftLocked(memberId: string): Promise<boolean> {
  const member = await db.query.members.findFirst({
    where: eq(members.id, memberId),
    columns: {
      guestSoftLocked: true,
    },
  });
  return member?.guestSoftLocked ?? false;
}

/**
 * Revoke an unused guest invite
 * Admin can invalidate invite links that haven't been redeemed
 */
export async function revokeGuestInvite(inviteId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get the invite record
  const invite = await db.query.guestInvites.findFirst({
    where: eq(guestInvites.id, inviteId),
  });

  if (!invite) {
    throw new Error("Invite not found");
  }

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, invite.organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can revoke guest invites");
  }

  // Can only revoke unused invites
  if (invite.usedBy) {
    throw new Error("Cannot revoke an already-used invite");
  }

  // Delete the invite
  await db.delete(guestInvites).where(eq(guestInvites.id, inviteId));

  revalidatePath("/");

  return { success: true };
}

/**
 * Get invite details by token for the join page
 * Public - doesn't require admin access
 */
export async function getGuestInviteByToken(token: string) {
  const invite = await db.query.guestInvites.findFirst({
    where: eq(guestInvites.token, token),
    with: {
      organization: {
        columns: {
          id: true,
          name: true,
          slug: true,
          logo: true,
        },
      },
    },
  });

  if (!invite) {
    return null;
  }

  // Parse channel IDs and fetch channel names
  const channelIds: string[] = JSON.parse(invite.channelIds);
  const channelList = await db.query.channels.findMany({
    where: inArray(channels.id, channelIds),
    columns: {
      id: true,
      name: true,
    },
  });

  return {
    id: invite.id,
    token: invite.token,
    organization: invite.organization,
    channels: channelList,
    expiresAt: invite.expiresAt,
    isUsed: !!invite.usedBy,
    isExpired: invite.expiresAt ? invite.expiresAt < new Date() : false,
  };
}

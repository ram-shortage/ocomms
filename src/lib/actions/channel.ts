"use server";

import { db } from "@/db";
import { channels, channelMembers, members } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function verifyOrgMembership(userId: string, organizationId: string): Promise<boolean> {
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });
  return !!membership;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createChannel(formData: {
  organizationId: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify user is member of target organization
  const isOrgMember = await verifyOrgMembership(session.user.id, formData.organizationId);
  if (!isOrgMember) {
    throw new Error("Not authorized to create channels in this organization");
  }

  const slug = slugify(formData.name);

  // Create channel and add creator as admin member in transaction
  const [channel] = await db.transaction(async (tx) => {
    const [newChannel] = await tx.insert(channels).values({
      organizationId: formData.organizationId,
      name: formData.name,
      slug,
      description: formData.description || null,
      isPrivate: formData.isPrivate || false,
      createdBy: session.user.id,
    }).returning();

    await tx.insert(channelMembers).values({
      channelId: newChannel.id,
      userId: session.user.id,
      role: "admin",
    });

    return [newChannel];
  });

  revalidatePath(`/`);
  return channel;
}

export async function getChannels(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify user is member of target organization
  const isOrgMember = await verifyOrgMembership(session.user.id, organizationId);
  if (!isOrgMember) {
    throw new Error("Not authorized to view channels in this organization");
  }

  // Get all public channels + private channels user is member of
  const allChannels = await db.query.channels.findMany({
    where: eq(channels.organizationId, organizationId),
    with: {
      members: true,
    },
  });

  // Filter: user can see public channels or private channels they're a member of
  // ARCH-03: Exclude archived channels from main list
  return allChannels.filter(
    (ch) => !ch.isArchived && (!ch.isPrivate || ch.members.some((m) => m.userId === session.user.id))
  );
}

export async function getUserChannels(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const userMemberships = await db.query.channelMembers.findMany({
    where: eq(channelMembers.userId, session.user.id),
    with: {
      channel: true,
    },
  });

  // ARCH-03: Exclude archived channels from user's channel list
  return userMemberships
    .filter((m) => m.channel.organizationId === organizationId && !m.channel.isArchived)
    .map((m) => m.channel);
}

export async function joinChannel(channelId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Check channel exists and is public
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });

  if (!channel) throw new Error("Channel not found");
  if (channel.isPrivate) throw new Error("Cannot join private channel directly");

  // Verify user is member of channel's organization
  const isOrgMember = await verifyOrgMembership(session.user.id, channel.organizationId);
  if (!isOrgMember) {
    throw new Error("Not authorized to join channels in this organization");
  }

  await db.insert(channelMembers).values({
    channelId,
    userId: session.user.id,
    role: "member",
  }).onConflictDoNothing();

  revalidatePath(`/`);
  return { success: true };
}

export async function leaveChannel(channelId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Check if user is the only admin
  const members = await db.query.channelMembers.findMany({
    where: eq(channelMembers.channelId, channelId),
  });

  const admins = members.filter((m) => m.role === "admin");
  const isOnlyAdmin = admins.length === 1 && admins[0].userId === session.user.id;

  if (isOnlyAdmin && members.length > 1) {
    throw new Error("Cannot leave: you are the only admin. Promote another member first.");
  }

  await db.delete(channelMembers).where(
    and(
      eq(channelMembers.channelId, channelId),
      eq(channelMembers.userId, session.user.id)
    )
  );

  revalidatePath(`/`);
  return { success: true };
}

export async function updateChannelTopic(channelId: string, topic: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify user is channel member
  const membership = await db.query.channelMembers.findFirst({
    where: and(
      eq(channelMembers.channelId, channelId),
      eq(channelMembers.userId, session.user.id)
    ),
  });

  if (!membership) throw new Error("Not a channel member");

  await db.update(channels)
    .set({ topic, updatedAt: new Date() })
    .where(eq(channels.id, channelId));

  revalidatePath(`/`);
  return { success: true };
}

export async function updateChannelDescription(channelId: string, description: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify user is channel admin
  const membership = await db.query.channelMembers.findFirst({
    where: and(
      eq(channelMembers.channelId, channelId),
      eq(channelMembers.userId, session.user.id)
    ),
  });

  if (!membership || membership.role !== "admin") {
    throw new Error("Only channel admins can update description");
  }

  await db.update(channels)
    .set({ description, updatedAt: new Date() })
    .where(eq(channels.id, channelId));

  revalidatePath(`/`);
  return { success: true };
}

export async function getChannel(organizationId: string, slug: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // SECFIX-04: Verify organization membership FIRST
  const isOrgMember = await verifyOrgMembership(session.user.id, organizationId);
  if (!isOrgMember) {
    return null; // Don't reveal channel exists - per CONTEXT.md
  }

  const channel = await db.query.channels.findFirst({
    where: and(
      eq(channels.organizationId, organizationId),
      eq(channels.slug, slug)
    ),
    with: {
      members: {
        with: {
          user: true,
        },
      },
    },
  });

  if (!channel) return null;

  // Check access for private channels
  if (channel.isPrivate) {
    const isMember = channel.members.some((m) => m.userId === session.user.id);
    if (!isMember) return null;
  }

  return channel;
}

export async function inviteToChannel(channelId: string, userId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify inviter is channel admin
  const inviterMembership = await db.query.channelMembers.findFirst({
    where: and(
      eq(channelMembers.channelId, channelId),
      eq(channelMembers.userId, session.user.id)
    ),
  });

  if (!inviterMembership || inviterMembership.role !== "admin") {
    throw new Error("Only channel admins can invite members");
  }

  // Verify channel is private (public channels use join, not invite)
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });

  if (!channel) throw new Error("Channel not found");
  if (!channel.isPrivate) throw new Error("Public channels don't require invitations");

  // Verify target user is workspace member
  const orgMembers = await db.query.members.findMany({
    where: eq(members.organizationId, channel.organizationId),
  });

  const isOrgMember = orgMembers.some((m) => m.userId === userId);
  if (!isOrgMember) throw new Error("User is not a workspace member");

  // Add to channel
  await db.insert(channelMembers).values({
    channelId,
    userId,
    role: "member",
  }).onConflictDoNothing();

  revalidatePath(`/`);
  return { success: true };
}

export async function getWorkspaceMembers(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify user is member of target organization
  const isOrgMember = await verifyOrgMembership(session.user.id, organizationId);
  if (!isOrgMember) {
    throw new Error("Not authorized to view members of this organization");
  }

  const orgMembers = await db.query.members.findMany({
    where: eq(members.organizationId, organizationId),
    with: {
      user: true,
    },
  });

  return orgMembers;
}

/**
 * ARCH-01: Archive a channel making it read-only
 * ARCH-06: Cannot archive the default channel (slug === "general")
 */
export async function archiveChannel(channelId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get channel with members
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
    with: {
      members: true,
    },
  });

  if (!channel) throw new Error("Channel not found");

  // ARCH-06: Default channel cannot be archived
  if (channel.slug === "general") {
    throw new Error("The default channel cannot be archived");
  }

  // Permission: must be channel admin or creator
  const membership = channel.members.find((m) => m.userId === session.user.id);
  const isCreator = channel.createdBy === session.user.id;
  const isAdmin = membership?.role === "admin";

  if (!isCreator && !isAdmin) {
    throw new Error("Only channel admins or the creator can archive this channel");
  }

  // Update: isArchived=true, archivedAt=now, archivedBy=session.user.id
  await db.update(channels)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      archivedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(channels.id, channelId));

  revalidatePath("/");
  return { success: true };
}

/**
 * ARCH-05: Unarchive a channel to restore normal operation
 */
export async function unarchiveChannel(channelId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get channel with members
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
    with: {
      members: true,
    },
  });

  if (!channel) throw new Error("Channel not found");

  // Permission: must be channel admin or creator
  const membership = channel.members.find((m) => m.userId === session.user.id);
  const isCreator = channel.createdBy === session.user.id;
  const isAdmin = membership?.role === "admin";

  if (!isCreator && !isAdmin) {
    throw new Error("Only channel admins or the creator can unarchive this channel");
  }

  // Update: isArchived=false, archivedAt=null, archivedBy=null
  await db.update(channels)
    .set({
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(channels.id, channelId));

  revalidatePath("/");
  return { success: true };
}

/**
 * ARCH-04: Get archived channels for organization
 * Returns archived channels where user has access (public or member of private)
 */
export async function getArchivedChannels(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify org membership
  const isOrgMember = await verifyOrgMembership(session.user.id, organizationId);
  if (!isOrgMember) {
    throw new Error("Not authorized to view channels in this organization");
  }

  // Get all archived channels in org
  const archivedChannels = await db.query.channels.findMany({
    where: and(
      eq(channels.organizationId, organizationId),
      eq(channels.isArchived, true)
    ),
    with: {
      members: true,
    },
  });

  // Filter: user can see public channels or private channels they're a member of
  return archivedChannels.filter(
    (ch) => !ch.isPrivate || ch.members.some((m) => m.userId === session.user.id)
  );
}

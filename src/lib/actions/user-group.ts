"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userGroups, userGroupMembers, members, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

/**
 * Verify user is admin or owner in the organization.
 */
async function verifyAdminAccess(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });

  return membership?.role === "admin" || membership?.role === "owner";
}

/**
 * Normalize handle to lowercase, alphanumeric + underscore only.
 */
function normalizeHandle(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * UGRP-01: Create a user group with a unique handle.
 * UGRP-05: Validate handle uniqueness within workspace.
 */
export async function createUserGroup(
  organizationId: string,
  name: string,
  handle: string,
  description?: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can create user groups");
  }

  // Normalize handle
  const normalizedHandle = normalizeHandle(handle);
  if (!normalizedHandle) {
    throw new Error("Handle must contain at least one alphanumeric character");
  }

  // Check handle uniqueness in workspace
  const existing = await db.query.userGroups.findFirst({
    where: and(
      eq(userGroups.organizationId, organizationId),
      eq(userGroups.handle, normalizedHandle)
    ),
  });

  if (existing) {
    throw new Error(`Handle @${normalizedHandle} is already taken`);
  }

  // Create group
  const [group] = await db
    .insert(userGroups)
    .values({
      organizationId,
      name,
      handle: normalizedHandle,
      description: description ?? null,
      createdBy: session.user.id,
    })
    .returning();

  return group;
}

/**
 * Update a user group.
 */
export async function updateUserGroup(
  groupId: string,
  updates: { name?: string; handle?: string; description?: string }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Get group to verify org
  const group = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, groupId),
  });

  if (!group) {
    throw new Error("Group not found");
  }

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, group.organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can update user groups");
  }

  // Build update values
  const updateValues: Partial<typeof userGroups.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) {
    updateValues.name = updates.name;
  }

  if (updates.description !== undefined) {
    updateValues.description = updates.description;
  }

  if (updates.handle !== undefined) {
    const normalizedHandle = normalizeHandle(updates.handle);
    if (!normalizedHandle) {
      throw new Error("Handle must contain at least one alphanumeric character");
    }

    // Check uniqueness if handle changed
    if (normalizedHandle !== group.handle) {
      const existing = await db.query.userGroups.findFirst({
        where: and(
          eq(userGroups.organizationId, group.organizationId),
          eq(userGroups.handle, normalizedHandle)
        ),
      });

      if (existing) {
        throw new Error(`Handle @${normalizedHandle} is already taken`);
      }
    }

    updateValues.handle = normalizedHandle;
  }

  // Update group
  const [updated] = await db
    .update(userGroups)
    .set(updateValues)
    .where(eq(userGroups.id, groupId))
    .returning();

  return updated;
}

/**
 * Delete a user group.
 */
export async function deleteUserGroup(groupId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Get group to verify org
  const group = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, groupId),
  });

  if (!group) {
    throw new Error("Group not found");
  }

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, group.organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can delete user groups");
  }

  // Delete group (cascade deletes memberships)
  await db.delete(userGroups).where(eq(userGroups.id, groupId));

  return { success: true };
}

/**
 * UGRP-04: Add a member to a group.
 * GUST-07: Guests cannot be added to user groups.
 */
export async function addGroupMember(groupId: string, userId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Get group to verify org
  const group = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, groupId),
  });

  if (!group) {
    throw new Error("Group not found");
  }

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, group.organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can add group members");
  }

  // Verify user is a member of the organization
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, group.organizationId)
    ),
  });

  if (!membership) {
    throw new Error("User is not a member of this workspace");
  }

  // GUST-07: Verify user is NOT a guest
  if (membership.isGuest) {
    throw new Error("Guests cannot be added to user groups");
  }

  // Check if already a member
  const existingMembership = await db.query.userGroupMembers.findFirst({
    where: and(
      eq(userGroupMembers.groupId, groupId),
      eq(userGroupMembers.userId, userId)
    ),
  });

  if (existingMembership) {
    throw new Error("User is already a member of this group");
  }

  // Add to group
  await db.insert(userGroupMembers).values({
    groupId,
    userId,
  });

  return { success: true };
}

/**
 * UGRP-04: Remove a member from a group.
 */
export async function removeGroupMember(groupId: string, userId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Get group to verify org
  const group = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, groupId),
  });

  if (!group) {
    throw new Error("Group not found");
  }

  // Verify admin access
  const isAdmin = await verifyAdminAccess(session.user.id, group.organizationId);
  if (!isAdmin) {
    throw new Error("Only admins can remove group members");
  }

  // Remove from group
  await db
    .delete(userGroupMembers)
    .where(
      and(
        eq(userGroupMembers.groupId, groupId),
        eq(userGroupMembers.userId, userId)
      )
    );

  return { success: true };
}

/**
 * Get user groups in a workspace.
 * For admin: returns all groups.
 * For non-admin: returns only groups user belongs to.
 */
export async function getUserGroups(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  const isAdmin = await verifyAdminAccess(session.user.id, organizationId);

  if (isAdmin) {
    // Admin sees all groups
    const groups = await db.query.userGroups.findMany({
      where: eq(userGroups.organizationId, organizationId),
      with: {
        members: true,
      },
      orderBy: (userGroups, { asc }) => [asc(userGroups.name)],
    });

    return groups.map((g) => ({
      ...g,
      memberCount: g.members.length,
    }));
  } else {
    // Non-admin only sees groups they belong to
    const memberships = await db.query.userGroupMembers.findMany({
      where: eq(userGroupMembers.userId, session.user.id),
      with: {
        group: {
          with: {
            members: true,
          },
        },
      },
    });

    // Filter to only groups in this organization
    return memberships
      .filter((m) => m.group.organizationId === organizationId)
      .map((m) => ({
        ...m.group,
        memberCount: m.group.members.length,
      }));
  }
}

/**
 * UGRP-03: Get members of a group.
 * No admin restriction - anyone in the organization can see group members.
 * M-9 FIX: Verify requester is in the group's organization.
 */
export async function getGroupMembers(groupId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Get the group to find its organization
  const group = await db.query.userGroups.findFirst({
    where: eq(userGroups.id, groupId),
  });
  if (!group) {
    throw new Error("Group not found");
  }

  // Verify requester is in the group's organization
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, group.organizationId),
      eq(members.userId, session.user.id)
    ),
  });
  if (!membership) {
    throw new Error("Not authorized to view members of this group");
  }

  // Get group members with user info
  const memberships = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.groupId, groupId),
    with: {
      user: true,
    },
  });

  // Return limited fields for non-admins (hide email)
  const isAdmin = membership.role === "admin" || membership.role === "owner";
  return memberships.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: isAdmin ? m.user.email : undefined,
    image: m.user.image,
  }));
}

/**
 * Get a group by its handle for mention resolution.
 * L-4 FIX: Require session and org membership before resolving handles.
 */
export async function getGroupByHandle(organizationId: string, handle: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Verify requester is in the organization
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, organizationId),
      eq(members.userId, session.user.id)
    ),
  });
  if (!membership) {
    throw new Error("Not authorized to view groups in this organization");
  }

  const normalizedHandle = normalizeHandle(handle);

  const group = await db.query.userGroups.findFirst({
    where: and(
      eq(userGroups.organizationId, organizationId),
      eq(userGroups.handle, normalizedHandle)
    ),
    with: {
      members: true,
    },
  });

  if (!group) {
    return null;
  }

  return {
    ...group,
    memberCount: group.members.length,
  };
}

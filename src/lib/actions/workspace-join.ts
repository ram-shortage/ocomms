"use server";

import { db } from "@/db";
import { organizations, members, workspaceJoinRequests } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, ne, sql, notInArray } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Get available workspaces that user can browse and join.
 * Excludes invite-only workspaces, workspaces user is already a member of,
 * and workspaces where user has a pending join request.
 */
export async function getAvailableWorkspaces() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Not authorized");
  }

  // Get workspaces where user is already a member
  const userMemberships = await db
    .select({ organizationId: members.organizationId })
    .from(members)
    .where(eq(members.userId, session.user.id));

  const memberWorkspaceIds = userMemberships.map((m) => m.organizationId);

  // Get workspaces where user has pending join requests
  const pendingRequests = await db
    .select({ organizationId: workspaceJoinRequests.organizationId })
    .from(workspaceJoinRequests)
    .where(
      and(
        eq(workspaceJoinRequests.userId, session.user.id),
        eq(workspaceJoinRequests.status, "pending")
      )
    );

  const pendingWorkspaceIds = pendingRequests.map((r) => r.organizationId);

  // Get all browsable workspaces (not invite-only) with member count
  const excludedWorkspaceIds = [
    ...memberWorkspaceIds,
    ...pendingWorkspaceIds,
  ];

  let query = db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logo: organizations.logo,
      description: organizations.description,
      joinPolicy: organizations.joinPolicy,
      memberCount: sql<number>`count(distinct ${members.id})::int`,
    })
    .from(organizations)
    .leftJoin(members, eq(members.organizationId, organizations.id))
    .where(ne(organizations.joinPolicy, "invite_only"))
    .groupBy(
      organizations.id,
      organizations.name,
      organizations.slug,
      organizations.logo,
      organizations.description,
      organizations.joinPolicy
    )
    .$dynamic();

  // Only apply notInArray if there are excluded workspaces
  if (excludedWorkspaceIds.length > 0) {
    query = query.where(notInArray(organizations.id, excludedWorkspaceIds));
  }

  const availableWorkspaces = await query;

  return availableWorkspaces;
}

/**
 * Submit a request to join a workspace that requires approval.
 * Creates a pending join request that workspace admins can approve/reject.
 */
export async function submitJoinRequest(
  workspaceId: string,
  message?: string
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Not authorized");
  }

  // Validate workspace exists and has "request" join policy
  const workspace = await db.query.organizations.findFirst({
    where: eq(organizations.id, workspaceId),
  });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  if (workspace.joinPolicy !== "request") {
    throw new Error(
      "This workspace does not accept join requests. It may be invite-only or allow open joining."
    );
  }

  // Validate user is not already a member
  const existingMembership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, workspaceId)
    ),
  });

  if (existingMembership) {
    throw new Error("You are already a member of this workspace");
  }

  // Validate no existing pending request (this will fail with unique constraint anyway)
  const existingRequest = await db.query.workspaceJoinRequests.findFirst({
    where: and(
      eq(workspaceJoinRequests.userId, session.user.id),
      eq(workspaceJoinRequests.organizationId, workspaceId),
      eq(workspaceJoinRequests.status, "pending")
    ),
  });

  if (existingRequest) {
    throw new Error("You already have a pending request for this workspace");
  }

  // Create join request
  await db.insert(workspaceJoinRequests).values({
    id: nanoid(),
    userId: session.user.id,
    organizationId: workspaceId,
    message: message || null,
    status: "pending",
  });

  return { success: true };
}

/**
 * Instantly join a workspace with "open" join policy.
 * Adds user as a member with "member" role.
 */
export async function joinOpenWorkspace(workspaceId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Not authorized");
  }

  // Validate workspace exists and has "open" join policy
  const workspace = await db.query.organizations.findFirst({
    where: eq(organizations.id, workspaceId),
  });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  if (workspace.joinPolicy !== "open") {
    throw new Error(
      "This workspace does not allow instant joining. You may need to request to join."
    );
  }

  // Validate user is not already a member
  const existingMembership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, workspaceId)
    ),
  });

  if (existingMembership) {
    throw new Error("You are already a member of this workspace");
  }

  // Add user to workspace using better-auth API
  await auth.api.addMember({
    headers: await headers(),
    body: {
      organizationId: workspaceId,
      userId: session.user.id,
      role: "member",
    },
  });

  return { success: true, slug: workspace.slug };
}

/**
 * Get all pending join requests for the current user.
 * Used to show pending request status in browse page.
 */
export async function getMyJoinRequests() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Not authorized");
  }

  const requests = await db
    .select({
      id: workspaceJoinRequests.id,
      workspaceId: workspaceJoinRequests.organizationId,
      workspaceName: organizations.name,
      message: workspaceJoinRequests.message,
      status: workspaceJoinRequests.status,
      createdAt: workspaceJoinRequests.createdAt,
    })
    .from(workspaceJoinRequests)
    .innerJoin(
      organizations,
      eq(organizations.id, workspaceJoinRequests.organizationId)
    )
    .where(
      and(
        eq(workspaceJoinRequests.userId, session.user.id),
        eq(workspaceJoinRequests.status, "pending")
      )
    );

  return requests;
}

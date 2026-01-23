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

/**
 * Get all pending join requests for a workspace.
 * Only accessible to workspace owners and admins.
 */
export async function getPendingRequests(workspaceId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Not authorized");
  }

  // Validate user is owner/admin of workspace
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, workspaceId)
    ),
  });

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new Error("Not authorized");
  }

  // Get pending requests with requester info using Drizzle relations
  const requests = await db.query.workspaceJoinRequests.findMany({
    where: and(
      eq(workspaceJoinRequests.organizationId, workspaceId),
      eq(workspaceJoinRequests.status, "pending")
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
    orderBy: (requests, { desc }) => [desc(requests.createdAt)],
  });

  return requests;
}

/**
 * Approve a join request - adds user to workspace and sends notification.
 * Only accessible to workspace owners and admins.
 */
export async function approveJoinRequest(requestId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Not authorized");
  }

  // Get request with workspace info
  const request = await db.query.workspaceJoinRequests.findFirst({
    where: eq(workspaceJoinRequests.id, requestId),
    with: {
      organization: true,
      user: true,
    },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== "pending") {
    throw new Error("Request has already been processed");
  }

  // Validate user is owner/admin of the request's workspace
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, request.organizationId)
    ),
  });

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new Error("Not authorized");
  }

  // Update request status
  await db
    .update(workspaceJoinRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: session.user.id,
    })
    .where(eq(workspaceJoinRequests.id, requestId));

  // Add user to workspace
  await auth.api.addMember({
    headers: await headers(),
    body: {
      organizationId: request.organizationId,
      userId: request.userId,
      role: "member",
    },
  });

  // Send approval email and notification (fire-and-forget)
  const { sendJoinRequestApprovedEmail } = await import("@/lib/email");
  sendJoinRequestApprovedEmail({
    to: request.user.email,
    workspaceName: request.organization.name,
    workspaceSlug: request.organization.slug || request.organizationId,
  }).catch((err) => console.error("[Approval] Failed to send email:", err));

  // Emit Socket.IO notification to requester
  const { getIOInstance } = await import("@/server/socket/handlers/guest");
  const io = getIOInstance();
  if (io) {
    io.to(`user:${request.userId}`).emit("workspace:join-request-approved", {
      requestId: request.id,
      workspaceId: request.organizationId,
      workspaceName: request.organization.name,
      workspaceSlug: request.organization.slug || request.organizationId,
    });
  }

  return { success: true };
}

/**
 * Reject a join request with optional reason.
 * Only accessible to workspace owners and admins.
 */
export async function rejectJoinRequest(requestId: string, reason?: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Not authorized");
  }

  // Get request with workspace info
  const request = await db.query.workspaceJoinRequests.findFirst({
    where: eq(workspaceJoinRequests.id, requestId),
    with: {
      organization: true,
      user: true,
    },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  if (request.status !== "pending") {
    throw new Error("Request has already been processed");
  }

  // Validate user is owner/admin of the request's workspace
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, request.organizationId)
    ),
  });

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new Error("Not authorized");
  }

  // Update request status
  await db
    .update(workspaceJoinRequests)
    .set({
      status: "rejected",
      rejectionReason: reason || null,
      reviewedAt: new Date(),
      reviewedBy: session.user.id,
    })
    .where(eq(workspaceJoinRequests.id, requestId));

  // Send rejection email (fire-and-forget)
  const { sendJoinRequestRejectedEmail } = await import("@/lib/email");
  sendJoinRequestRejectedEmail({
    to: request.user.email,
    workspaceName: request.organization.name,
    reason,
  }).catch((err) => console.error("[Rejection] Failed to send email:", err));

  // Emit Socket.IO notification to requester
  const { getIOInstance } = await import("@/server/socket/handlers/guest");
  const io = getIOInstance();
  if (io) {
    io.to(`user:${request.userId}`).emit("workspace:join-request-rejected", {
      requestId: request.id,
      workspaceId: request.organizationId,
      workspaceName: request.organization.name,
      reason,
    });
  }

  return { success: true };
}

/**
 * Approve multiple join requests at once.
 * Returns counts of successful and failed approvals.
 */
export async function bulkApproveRequests(requestIds: string[]) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Not authorized");
  }

  let approved = 0;
  const failed: string[] = [];

  for (const requestId of requestIds) {
    try {
      await approveJoinRequest(requestId);
      approved++;
    } catch (error) {
      console.error(`[Bulk Approve] Failed to approve request ${requestId}:`, error);
      failed.push(requestId);
    }
  }

  return { success: true, approved, failed };
}

/**
 * Reject multiple join requests at once with the same reason.
 * Returns counts of successful and failed rejections.
 */
export async function bulkRejectRequests(requestIds: string[], reason?: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Not authorized");
  }

  let rejected = 0;
  const failed: string[] = [];

  for (const requestId of requestIds) {
    try {
      await rejectJoinRequest(requestId, reason);
      rejected++;
    } catch (error) {
      console.error(`[Bulk Reject] Failed to reject request ${requestId}:`, error);
      failed.push(requestId);
    }
  }

  return { success: true, rejected, failed };
}

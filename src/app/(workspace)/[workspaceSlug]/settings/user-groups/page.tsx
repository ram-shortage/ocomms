import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { organizations, members } from "@/db/schema";
import { getUserGroups } from "@/lib/actions/user-group";
import { UserGroupsClient } from "./user-groups-client";

/**
 * User Groups Settings Page
 *
 * Admin-only page for managing user groups for @mentions.
 */
export default async function UserGroupsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get organization
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.slug, workspaceSlug),
  });

  if (!organization) {
    notFound();
  }

  // Check user is admin or owner
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, organization.id)
    ),
  });

  const isAdmin = membership?.role === "owner" || membership?.role === "admin";
  if (!isAdmin) {
    notFound();
  }

  // Get user groups
  const groups = await getUserGroups(organization.id);

  return (
    <UserGroupsClient
      organizationId={organization.id}
      workspaceSlug={workspaceSlug}
      initialGroups={groups}
    />
  );
}

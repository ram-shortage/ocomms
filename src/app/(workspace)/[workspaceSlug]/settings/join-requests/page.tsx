import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { organizations, members } from "@/db/schema";
import { getPendingRequests } from "@/lib/actions/workspace-join";
import { JoinRequestListWrapper } from "./join-request-list-wrapper";

export default async function JoinRequestsPage({
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

  // Validate user is owner/admin
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, organization.id)
    ),
  });

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    redirect(`/${workspaceSlug}/settings`);
  }

  // Get pending requests
  const pendingRequests = await getPendingRequests(organization.id);

  return (
    <div className="h-full overflow-auto">
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Join Requests</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and manage workspace join requests
            </p>
          </div>
          <Link
            href={`/${workspaceSlug}/settings`}
            className="text-sm text-primary hover:underline"
          >
            Back to settings
          </Link>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {pendingRequests.length} pending request{pendingRequests.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <JoinRequestListWrapper
          initialRequests={pendingRequests.map((req) => ({
            ...req,
            createdAt: new Date(req.createdAt),
          }))}
        />
      </div>
    </div>
  );
}

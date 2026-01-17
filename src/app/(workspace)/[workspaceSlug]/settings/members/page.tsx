import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { MemberList } from "@/components/workspace/member-list";
import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import Link from "next/link";

export default async function MembersSettingsPage({
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

  // Get organization with members
  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  });

  const workspace = orgs?.find((org) => org.slug === workspaceSlug);

  if (!workspace) {
    notFound();
  }

  // Get full organization details with members
  const fullOrg = await auth.api.getFullOrganization({
    query: { organizationId: workspace.id },
    headers: await headers(),
  });

  if (!fullOrg) {
    notFound();
  }

  // Find current user's membership
  const currentMembership = fullOrg.members?.find(
    (m) => m.userId === session.user.id
  );

  const canInvite =
    currentMembership?.role === "owner" ||
    currentMembership?.role === "admin";

  // Transform members to match the MemberList interface
  const members = (fullOrg.members || []).map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role as "owner" | "admin" | "member",
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    },
  }));

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Members</h1>
        <Link
          href={`/${workspaceSlug}/settings`}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to settings
        </Link>
      </div>

      {canInvite && (
        <div className="mb-8 p-4 bg-white border rounded">
          <h2 className="text-lg font-medium mb-4">Invite Member</h2>
          <InviteMemberForm organizationId={workspace.id} />
        </div>
      )}

      <div>
        <h2 className="text-lg font-medium mb-4">
          Members ({members.length})
        </h2>
        <MemberList
          members={members}
          organizationId={workspace.id}
          workspaceSlug={workspaceSlug}
          currentUserId={session.user.id}
          currentUserRole={currentMembership?.role as "owner" | "admin" | "member" || "member"}
        />
      </div>
    </div>
  );
}

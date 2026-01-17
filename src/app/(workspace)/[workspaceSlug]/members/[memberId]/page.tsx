import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { ProfileCard } from "@/components/profile/profile-card";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; memberId: string }>;
}) {
  const { workspaceSlug, memberId } = await params;

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

  // Get full organization to find member
  const fullOrg = await auth.api.getFullOrganization({
    query: { organizationId: workspace.id },
    headers: await headers(),
  });

  const member = fullOrg?.members?.find((m) => m.id === memberId);

  if (!member) {
    notFound();
  }

  // Get profile for this member
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, member.userId),
  });

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Member Profile</h1>
        <Link
          href={`/${workspaceSlug}/settings/members`}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to members
        </Link>
      </div>
      <ProfileCard
        displayName={profile?.displayName || member.user.name}
        email={member.user.email}
        avatarPath={profile?.avatarPath}
        bio={profile?.bio}
        role={member.role}
      />
    </div>
  );
}

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { organizations, members } from "@/db/schema";
import { NotificationsSection } from "./notifications-section";
import { StorageUsage } from "@/components/settings/storage-usage";

export default async function WorkspaceSettingsPage({
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

  // Get organization and membership for admin check
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.slug, workspaceSlug),
  });

  let isAdmin = false;
  if (organization) {
    const membership = await db.query.members.findFirst({
      where: and(
        eq(members.userId, session.user.id),
        eq(members.organizationId, organization.id)
      ),
    });
    isAdmin = membership?.role === "owner" || membership?.role === "admin";
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Workspace Settings</h1>

      {/* Navigation section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Workspace</h2>
        <nav className="space-y-2">
          <Link
            href={`/${workspaceSlug}/settings/members`}
            className="block p-4 bg-card border rounded hover:bg-muted"
          >
            <h3 className="font-medium">Members</h3>
            <p className="text-sm text-muted-foreground">
              Invite members and manage roles
            </p>
          </Link>
        </nav>
      </section>

      {/* Admin section - only for admins/owners */}
      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Administration</h2>
          <nav className="space-y-2">
            <Link
              href={`/${workspaceSlug}/settings/guests`}
              className="block p-4 bg-card border rounded hover:bg-muted"
            >
              <h3 className="font-medium">Guest Management</h3>
              <p className="text-sm text-muted-foreground">
                Invite guests and manage their channel access
              </p>
            </Link>
            <Link
              href={`/${workspaceSlug}/settings/user-groups`}
              className="block p-4 bg-card border rounded hover:bg-muted"
            >
              <h3 className="font-medium">User Groups</h3>
              <p className="text-sm text-muted-foreground">
                Create groups for @mentions
              </p>
            </Link>
            <Link
              href={`/${workspaceSlug}/settings/emoji`}
              className="block p-4 bg-card border rounded hover:bg-muted"
            >
              <h3 className="font-medium">Custom Emoji</h3>
              <p className="text-sm text-muted-foreground">
                Upload and manage workspace emoji
              </p>
            </Link>
            <Link
              href={`/${workspaceSlug}/settings/analytics`}
              className="block p-4 bg-card border rounded hover:bg-muted"
            >
              <h3 className="font-medium">Analytics</h3>
              <p className="text-sm text-muted-foreground">
                View workspace metrics and activity trends
              </p>
            </Link>
            <Link
              href={`/${workspaceSlug}/settings/admin`}
              className="block p-4 bg-card border rounded hover:bg-muted"
            >
              <h3 className="font-medium">Audit Logs & Export</h3>
              <p className="text-sm text-muted-foreground">
                View security logs and export organization data
              </p>
            </Link>
          </nav>
        </section>
      )}

      {/* Notifications section */}
      <NotificationsSection />

      {/* Storage usage section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Your Account</h2>
        <div className="p-4 bg-card border rounded">
          <StorageUsage />
        </div>
      </section>

      <div className="pt-4">
        <Link
          href={`/${workspaceSlug}`}
          className="text-sm text-primary hover:underline"
        >
          Back to workspace
        </Link>
      </div>
    </div>
  );
}

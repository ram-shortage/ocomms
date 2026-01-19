import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { organizations, members } from "@/db/schema";
import { NotificationsSection } from "./notifications-section";

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
            className="block p-4 bg-white border rounded hover:bg-gray-50"
          >
            <h3 className="font-medium">Members</h3>
            <p className="text-sm text-gray-500">
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
              href={`/${workspaceSlug}/settings/admin`}
              className="block p-4 bg-white border rounded hover:bg-gray-50"
            >
              <h3 className="font-medium">Audit Logs & Export</h3>
              <p className="text-sm text-gray-500">
                View security logs and export organization data
              </p>
            </Link>
          </nav>
        </section>
      )}

      {/* Notifications section */}
      <NotificationsSection />

      <div className="pt-4">
        <Link
          href={`/${workspaceSlug}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to workspace
        </Link>
      </div>
    </div>
  );
}

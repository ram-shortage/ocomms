import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { organizations, members, channelCategories } from "@/db/schema";
import { getSidebarPreferences } from "@/lib/actions/sidebar-preferences";
import { SidebarSettingsClient } from "./sidebar-settings-client";

export default async function SidebarSettingsPage({
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
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, workspaceSlug),
  });

  if (!org) {
    redirect("/");
  }

  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, org.id)
    ),
  });

  if (!membership) {
    redirect("/");
  }

  const isAdmin = membership.role === "owner" || membership.role === "admin";

  // Fetch categories for this org (for category management section)
  const categories = await db.query.channelCategories.findMany({
    where: eq(channelCategories.organizationId, org.id),
    orderBy: channelCategories.sortOrder,
  });

  // Fetch user's sidebar preferences
  const preferences = await getSidebarPreferences(org.id);

  return (
    <div className="h-full overflow-auto">
      <div className="p-8 max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold">Sidebar Settings</h1>

        <SidebarSettingsClient
          organizationId={org.id}
          categories={categories}
          preferences={preferences}
          isAdmin={isAdmin}
        />

        <div className="pt-4">
          <Link
            href={`/${workspaceSlug}/settings`}
            className="text-sm text-primary hover:underline"
          >
            Back to settings
          </Link>
        </div>
      </div>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { organizations, members } from "@/db/schema";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

/**
 * Analytics Dashboard Page
 *
 * Displays workspace analytics including message volume, user activity,
 * channel activity, and storage usage. Admin-only access.
 * Implements ANLY-01 through ANLY-08.
 */
export default async function AnalyticsPage({
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

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Workspace Analytics</h1>
          <Link
            href={`/${workspaceSlug}/settings`}
            className="text-sm text-primary hover:underline"
          >
            Back to settings
          </Link>
        </div>

        <AnalyticsDashboard
          organizationId={organization.id}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </div>
  );
}

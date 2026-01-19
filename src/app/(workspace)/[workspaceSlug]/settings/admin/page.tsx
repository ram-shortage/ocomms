import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { organizations, members } from "@/db/schema";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";
import { ExportDataButton } from "@/components/admin/export-data-button";

/**
 * Admin Settings Page
 *
 * Provides access to audit logs and data export for organization admins.
 * Only accessible to users with admin or owner role.
 */
export default async function AdminSettingsPage({
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

  const isOwner = membership?.role === "owner";

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Administration</h1>

      {/* Audit Logs Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Audit Logs</h2>
        <p className="text-sm text-gray-600">
          View security events for your organization. Logs are retained for 90
          days.
        </p>
        <AuditLogViewer organizationId={organization.id} />
      </section>

      {/* Data Export Section - only show to owners */}
      {isOwner && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Data Export</h2>
          <p className="text-sm text-gray-600">
            Export all organization data including members, channels, messages,
            and settings. This export can be used for backup or data portability
            (GDPR compliance).
          </p>
          <ExportDataButton organizationId={organization.id} />
        </section>
      )}

      <div className="pt-4">
        <Link
          href={`/${workspaceSlug}/settings`}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to settings
        </Link>
      </div>
    </div>
  );
}

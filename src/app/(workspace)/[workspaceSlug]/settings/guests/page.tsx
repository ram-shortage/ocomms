import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { organizations, members, channels } from "@/db/schema";
import { getWorkspaceGuests, getGuestInvites } from "@/lib/actions/guest";
import { GuestList } from "@/components/guest/guest-list";
import { GuestInviteDialog } from "@/components/guest/guest-invite-dialog";
import { GuestInviteList } from "@/components/guest/guest-invite-list";

/**
 * Guest Management Settings Page
 *
 * Admin-only page for managing guest invites and guest access.
 * Features:
 * - Create guest invite links with channel selection
 * - View and revoke pending invite links
 * - View all guests with their channel access
 * - Extend or remove guest access
 */
export default async function GuestSettingsPage({
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

  // Get all channels for the workspace (for invite creation)
  const workspaceChannels = await db.query.channels.findMany({
    where: and(
      eq(channels.organizationId, organization.id),
      eq(channels.isArchived, false)
    ),
    columns: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: (channels, { asc }) => [asc(channels.name)],
  });

  // Get guests and invites
  const [guests, invites] = await Promise.all([
    getWorkspaceGuests(organization.id),
    getGuestInvites(organization.id),
  ]);

  return (
    <div className="h-full overflow-auto">
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Guest Management</h1>
          <Link
            href={`/${workspaceSlug}/settings`}
            className="text-sm text-primary hover:underline"
          >
            Back to settings
          </Link>
        </div>

        {/* Invite Links Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Invite Links</h2>
              <p className="text-sm text-muted-foreground">
                Create shareable links to invite guests to specific channels
              </p>
            </div>
            <GuestInviteDialog
              organizationId={organization.id}
              channels={workspaceChannels}
            />
          </div>
          <GuestInviteList
            invites={invites}
            channels={workspaceChannels}
          />
        </section>

        {/* Active Guests Section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">
              Active Guests ({guests.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage guest access and expiration settings
            </p>
          </div>
          <GuestList
            guests={guests}
            workspaceSlug={workspaceSlug}
          />
        </section>
      </div>
    </div>
  );
}

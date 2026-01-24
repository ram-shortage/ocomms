import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { members } from "@/db/schema";
import { PresenceWrapper } from "@/components/presence/presence-wrapper";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { MobileSidebarDrawer } from "@/components/mobile/mobile-sidebar-drawer";
import { ReminderListener } from "@/components/reminder/reminder-listener";
import { GuestWelcomeWrapper } from "@/components/guest/guest-welcome-wrapper";
import { getUserChannels } from "@/lib/actions/channel";
import { getUserConversations } from "@/lib/actions/conversation";
import { getCategories, getCollapseStates } from "@/lib/actions/channel-category";
import { getMyStatus } from "@/lib/actions/user-status";

export default async function WorkspaceSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get all organizations for workspace switcher
  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  });

  const workspace = orgs?.find((org) => org.slug === workspaceSlug);

  if (!workspace) {
    notFound();
  }

  // Get workspace members for initial presence
  const membersResponse = await auth.api.listMembers({
    headers: await headers(),
    query: { organizationId: workspace.id },
  });

  const memberUserIds = membersResponse?.members?.map((m) => m.userId) || [];

  // Fetch member counts for all workspaces
  const workspacesWithMemberCounts = await Promise.all(
    (orgs || []).map(async (org) => {
      const orgMembers = await auth.api.listMembers({
        headers: await headers(),
        query: { organizationId: org.id },
      });
      return {
        id: org.id,
        name: org.name,
        slug: org.slug || "",
        logo: org.logo || null,
        memberCount: orgMembers?.members?.length || 0,
        lastActivityAt: null, // Can be enhanced later to fetch from messages
      };
    })
  );

  // Determine if current user is admin/owner
  const currentMember = membersResponse?.members?.find(
    (m) => m.userId === session.user.id
  );
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";

  // Check if current user is a guest (from our members table, not better-auth)
  const memberRecord = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, workspace.id)
    ),
    columns: {
      isGuest: true,
    },
  });
  const isGuest = memberRecord?.isGuest ?? false;

  // Fetch channels, conversations, categories, collapse states, and status for sidebar
  const [channels, conversations, categories, collapseStates, myStatus] = await Promise.all([
    getUserChannels(workspace.id),
    getUserConversations(workspace.id),
    getCategories(workspace.id),
    getCollapseStates(workspace.id),
    getMyStatus(),
  ]);

  // Transform channels for sidebar
  const sidebarChannels = channels.map((ch) => ({
    id: ch.id,
    name: ch.name,
    slug: ch.slug,
    isPrivate: ch.isPrivate,
    categoryId: ch.categoryId ?? null,
    sortOrder: ch.sortOrder ?? 0,
  }));

  // Transform conversations for sidebar (1:1 DMs only for simplicity)
  const sidebarConversations = conversations
    .filter((conv) => !conv.isGroup)
    .map((conv) => {
      const otherParticipant = conv.participants.find(
        (p) => p.userId !== session.user.id
      );
      return {
        id: conv.id,
        otherUser: {
          id: otherParticipant?.user.id || "",
          name: otherParticipant?.user.name || null,
          email: otherParticipant?.user.email || "",
          image: otherParticipant?.user.image || null,
        },
        lastMessageAt: null, // Would need to be fetched separately
      };
    });

  return (
    <PresenceWrapper workspaceId={workspace.id} memberUserIds={memberUserIds}>
      <div className="flex h-dvh flex-col md:flex-row">
        {/* Mobile header + sidebar drawer - mobile only */}
        <MobileSidebarDrawer
          workspace={{
            id: workspace.id,
            name: workspace.name,
            slug: workspaceSlug,
          }}
          currentUserId={session.user.id}
          channels={sidebarChannels}
          conversations={sidebarConversations}
          categories={categories}
          collapseStates={collapseStates}
          isAdmin={isAdmin}
          myStatus={myStatus}
          workspaces={workspacesWithMemberCounts}
        />

        {/* Sidebar - desktop only */}
        <div className="hidden md:flex h-full">
          <WorkspaceSidebar
            workspace={{
              id: workspace.id,
              name: workspace.name,
              slug: workspaceSlug,
            }}
            currentUserId={session.user.id}
            channels={sidebarChannels}
            conversations={sidebarConversations}
            categories={categories}
            collapseStates={collapseStates}
            isAdmin={isAdmin}
            myStatus={myStatus}
            workspaces={workspacesWithMemberCounts}
          />
        </div>

        {/* Main content - with top padding on mobile for header (includes safe area) */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden pt-[calc(env(safe-area-inset-top)+3.5rem)] md:pt-0">
          {children}
        </main>

        {/* RMND-*: Reminder toast listener */}
        <ReminderListener workspaceSlug={workspaceSlug} />

        {/* GUST-*: Guest welcome modal */}
        <GuestWelcomeWrapper
          organizationId={workspace.id}
          workspaceName={workspace.name}
          channels={sidebarChannels.map((ch) => ch.name)}
          isGuest={isGuest}
        />
      </div>
    </PresenceWrapper>
  );
}

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { PresenceWrapper } from "@/components/presence/presence-wrapper";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { MobileTabBar } from "@/components/layout";
import { getUserChannels } from "@/lib/actions/channel";
import { getUserConversations } from "@/lib/actions/conversation";

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

  // Get organization by slug
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

  // Fetch channels and conversations for sidebar
  const [channels, conversations] = await Promise.all([
    getUserChannels(workspace.id),
    getUserConversations(workspace.id),
  ]);

  // Transform channels for sidebar
  const sidebarChannels = channels.map((ch) => ({
    id: ch.id,
    name: ch.name,
    slug: ch.slug,
    isPrivate: ch.isPrivate,
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
        {/* Sidebar - desktop only */}
        <div className="hidden md:block">
          <WorkspaceSidebar
            workspace={{
              id: workspace.id,
              name: workspace.name,
              slug: workspaceSlug,
            }}
            currentUserId={session.user.id}
            channels={sidebarChannels}
            conversations={sidebarConversations}
          />
        </div>

        {/* Main content - with bottom padding on mobile for tab bar */}
        <main className="flex-1 overflow-hidden pb-16 md:pb-0">
          {children}
        </main>

        {/* Bottom tabs - mobile only */}
        <MobileTabBar workspaceSlug={workspaceSlug} />
      </div>
    </PresenceWrapper>
  );
}

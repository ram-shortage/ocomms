import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getUserConversations } from "@/lib/actions/conversation";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { StartDMDialog } from "@/components/dm/start-dm-dialog";

export default async function DMListPage({
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

  // Get organization by slug
  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  });
  const workspace = orgs?.find((org) => org.slug === workspaceSlug);

  if (!workspace) {
    notFound();
  }

  // Fetch user's DM conversations using existing action
  const conversations = await getUserConversations(workspace.id);

  // Transform conversations with other user info
  const conversationsWithUsers = conversations
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((conv) => {
      const otherParticipants = conv.participants.filter(
        (p) => p.userId !== session.user.id
      );
      return {
        id: conv.id,
        isGroup: conv.isGroup,
        name: conv.name,
        updatedAt: conv.updatedAt,
        otherUsers: otherParticipants.map((p) => ({
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
          image: p.user.image,
        })),
      };
    });

  return (
    <div className="flex flex-col h-full">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-lg">Direct Messages</h1>
        <StartDMDialog
          currentUserId={session.user.id}
          organizationId={workspace.id}
          workspaceSlug={workspaceSlug}
        />
      </header>

      <div className="flex-1 overflow-y-auto">
        {conversationsWithUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4" />
            <p>No conversations yet</p>
            <p className="text-sm">Start a new conversation above</p>
          </div>
        ) : (
          <ul className="divide-y">
            {conversationsWithUsers.map((conv) => {
              // For group DMs, show group name or list of names
              const displayName = conv.isGroup
                ? conv.name ||
                  conv.otherUsers
                    .map((u) => u.name || u.email)
                    .slice(0, 3)
                    .join(", ") +
                    (conv.otherUsers.length > 3
                      ? ` +${conv.otherUsers.length - 3}`
                      : "")
                : conv.otherUsers[0]?.name ||
                  conv.otherUsers[0]?.email ||
                  "Unknown";

              const firstUser = conv.otherUsers[0];

              return (
                <li key={conv.id}>
                  <Link
                    href={`/${workspaceSlug}/dm/${conv.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                      {conv.isGroup ? (
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                      ) : firstUser?.image ? (
                        <img
                          src={firstUser.image}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        (firstUser?.name || firstUser?.email || "?")
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{displayName}</p>
                      {conv.updatedAt && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(conv.updatedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

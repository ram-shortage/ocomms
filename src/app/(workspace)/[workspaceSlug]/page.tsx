import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChannelList } from "@/components/channel/channel-list";
import { CreateChannelDialog } from "@/components/channel/create-channel-dialog";
import { DMList } from "@/components/dm/dm-list";
import { StartDMDialog } from "@/components/dm/start-dm-dialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function WorkspacePage({
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

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-bold truncate">{workspace.name}</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Channels
            </span>
            <CreateChannelDialog
              organizationId={workspace.id}
              workspaceSlug={workspaceSlug}
              trigger={
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Create channel</span>
                </Button>
              }
            />
          </div>
          <ChannelList
            organizationId={workspace.id}
            workspaceSlug={workspaceSlug}
          />
          <div className="px-3 py-2 mt-2">
            <Link
              href={`/${workspaceSlug}/channels`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Browse all channels
            </Link>
          </div>

          {/* Direct Messages section */}
          <div className="px-3 py-2 mt-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Direct Messages
            </span>
            <StartDMDialog
              organizationId={workspace.id}
              workspaceSlug={workspaceSlug}
              currentUserId={session.user.id}
              trigger={
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">New message</span>
                </Button>
              }
            />
          </div>
          <DMList
            organizationId={workspace.id}
            workspaceSlug={workspaceSlug}
          />
        </div>
        <div className="p-3 border-t space-y-1 text-sm">
          <Link
            href={`/${workspaceSlug}/profile`}
            className="block px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            Edit Profile
          </Link>
          <Link
            href={`/${workspaceSlug}/settings`}
            className="block px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            Settings
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <h2 className="text-xl font-semibold mb-4">
            Welcome to {workspace.name}
          </h2>
          <p className="text-muted-foreground">
            Select a channel from the sidebar to start a conversation, or{" "}
            <Link
              href={`/${workspaceSlug}/channels`}
              className="text-blue-600 hover:underline"
            >
              browse all channels
            </Link>{" "}
            to find one to join.
          </p>
        </div>
      </main>
    </div>
  );
}

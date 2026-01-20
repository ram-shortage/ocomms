"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChannelListClient } from "@/components/channel/channel-list-client";
import { DMListClient } from "@/components/dm/dm-list-client";
import { CreateChannelDialog } from "@/components/channel/create-channel-dialog";
import { StartDMDialog } from "@/components/dm/start-dm-dialog";
import { NotificationBell } from "@/components/notification/notification-bell";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface WorkspaceSidebarProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  currentUserId: string;
  channels: Array<{
    id: string;
    name: string;
    slug: string;
    isPrivate: boolean;
  }>;
  conversations: Array<{
    id: string;
    otherUser: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
    lastMessageAt: Date | null;
  }>;
}

export function WorkspaceSidebar({
  workspace,
  currentUserId,
  channels,
  conversations,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
      {/* Workspace header */}
      <div className="p-4 border-b flex items-center justify-between">
        <Link href={`/${workspace.slug}`} className="font-bold truncate hover:underline">
          {workspace.name}
        </Link>
        <NotificationBell workspaceSlug={workspace.slug} />
      </div>

      {/* Navigation items */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Quick links */}
        <div className="px-3 py-1">
          <Link
            href={`/${workspace.slug}/threads`}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
              pathname === `/${workspace.slug}/threads` && "bg-accent"
            )}
          >
            <MessageSquare className="h-4 w-4" />
            Threads
          </Link>
          <Link
            href={`/${workspace.slug}/search`}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
              pathname === `/${workspace.slug}/search` && "bg-accent"
            )}
          >
            <Search className="h-4 w-4" />
            Search
          </Link>
        </div>

        {/* Channels section */}
        <div className="px-3 py-2 mt-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Channels
          </span>
          <CreateChannelDialog
            organizationId={workspace.id}
            workspaceSlug={workspace.slug}
            trigger={
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <Plus className="h-4 w-4" />
                <span className="sr-only">Create channel</span>
              </Button>
            }
          />
        </div>
        <ChannelListClient
          channels={channels}
          workspaceSlug={workspace.slug}
        />
        <div className="px-3 py-2">
          <Link
            href={`/${workspace.slug}/channels`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Browse all channels
          </Link>
        </div>

        {/* Direct Messages section */}
        <div className="px-3 py-2 mt-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Direct Messages
          </span>
          <StartDMDialog
            organizationId={workspace.id}
            workspaceSlug={workspace.slug}
            currentUserId={currentUserId}
            trigger={
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <Plus className="h-4 w-4" />
                <span className="sr-only">New message</span>
              </Button>
            }
          />
        </div>
        <DMListClient
          conversations={conversations}
          workspaceSlug={workspace.slug}
        />
      </div>

      {/* Footer */}
      <div className="p-3 border-t space-y-1 text-sm">
        <Link
          href={`/${workspace.slug}/profile`}
          className={cn(
            "block px-3 py-1.5 rounded-md hover:bg-accent transition-colors",
            pathname === `/${workspace.slug}/profile` && "bg-accent"
          )}
        >
          Edit Profile
        </Link>
        <Link
          href={`/${workspace.slug}/settings`}
          className={cn(
            "block px-3 py-1.5 rounded-md hover:bg-accent transition-colors",
            pathname.startsWith(`/${workspace.slug}/settings`) && "bg-accent"
          )}
        >
          Settings
        </Link>
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <LogoutButton
          variant="ghost"
          className="w-full justify-start px-3 py-1.5 h-auto font-normal hover:bg-accent"
        />
      </div>
    </aside>
  );
}

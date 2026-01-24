"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { NotificationBell } from "@/components/notification/notification-bell";

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  channelCount: number;
}

interface MobileSidebarDrawerProps {
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
    categoryId?: string | null;
    sortOrder?: number;
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
  categories?: Category[];
  collapseStates?: Record<string, boolean>;
  isAdmin?: boolean;
  myStatus?: {
    emoji: string | null;
    text: string | null;
    expiresAt: Date | null;
    dndEnabled: boolean;
  } | null;
  workspaces?: Array<{
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    memberCount: number;
    lastActivityAt: Date | null;
  }>;
}

/**
 * Mobile header with hamburger menu that opens a left-side drawer containing the sidebar.
 * Replaces the bottom tab bar for mobile navigation.
 */
export function MobileSidebarDrawer({
  workspace,
  currentUserId,
  channels,
  conversations,
  categories,
  collapseStates,
  isAdmin = false,
  myStatus,
  workspaces,
}: MobileSidebarDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);

  // Close drawer when pathname changes (actual navigation occurred)
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      setOpen(false);
      prevPathnameRef.current = pathname;
    }
  }, [pathname]);

  // Derive page title from pathname
  const getPageTitle = () => {
    const path = pathname.replace(`/${workspace.slug}`, "");

    if (path === "" || path === "/") return workspace.name;
    if (path.startsWith("/channels/")) {
      const channelSlug = path.split("/")[2];
      const channel = channels.find((c) => c.slug === channelSlug);
      return channel ? `#${channel.name}` : "Channel";
    }
    if (path.startsWith("/dm/")) return "Direct Message";
    if (path === "/dm") return "Direct Messages";
    if (path === "/threads") return "Mentions & Threads";
    if (path === "/search") return "Search";
    if (path === "/channels") return "Browse Channels";
    if (path.startsWith("/settings")) return "Settings";
    if (path.startsWith("/profile")) return "Profile";
    if (path === "/scheduled") return "Scheduled Messages";
    if (path === "/reminders") return "Reminders";
    if (path === "/saved") return "Saved Items";
    if (path === "/notes") return "My Notes";

    return workspace.name;
  };

  return (
    <>
      {/* Mobile Header - fixed at top */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 border-b bg-background md:hidden",
          "pt-[env(safe-area-inset-top)]",
          "pl-[env(safe-area-inset-left)]",
          "pr-[env(safe-area-inset-right)]"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {/* Hamburger menu button */}
          <button
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-accent active:bg-accent"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Page title */}
          <h1 className="font-semibold text-base truncate max-w-[200px]">
            {getPageTitle()}
          </h1>

          {/* Notifications */}
          <div className="flex h-10 w-10 items-center justify-center">
            <NotificationBell workspaceSlug={workspace.slug} />
          </div>
        </div>
      </header>

      {/* Left-side drawer containing sidebar */}
      <DrawerPrimitive.Root
        open={open}
        onOpenChange={setOpen}
        direction="left"
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DrawerPrimitive.Content
            className={cn(
              "fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-background",
              "focus:outline-none"
            )}
          >
            {/* Close button inside drawer */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Sidebar content */}
            <div className="h-full">
              <WorkspaceSidebar
                workspace={workspace}
                currentUserId={currentUserId}
                channels={channels}
                conversations={conversations}
                categories={categories}
                collapseStates={collapseStates}
                isAdmin={isAdmin}
                myStatus={myStatus}
                workspaces={workspaces}
              />
            </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </>
  );
}

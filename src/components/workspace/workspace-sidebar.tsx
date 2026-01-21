"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, MessageSquare, StickyNote, FolderPlus, Bell, Clock, Bookmark, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChannelListClient } from "@/components/channel/channel-list-client";
import { CategorySidebar } from "@/components/channel/category-sidebar";
import { ArchivedChannelsSection } from "@/components/channel/archived-channels-section";
import { CreateCategoryDialog } from "@/components/channel/create-category-dialog";
import { DMListClient } from "@/components/dm/dm-list-client";
import { CreateChannelDialog } from "@/components/channel/create-channel-dialog";
import { StartDMDialog } from "@/components/dm/start-dm-dialog";
import { NotificationBell } from "@/components/notification/notification-bell";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReminderBadge } from "@/components/reminder/reminder-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusEditor, UserStatusData } from "@/components/status/status-editor";
import { StatusDisplay } from "@/components/status/status-display";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  channelCount: number;
}

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
  /** STAT-01: Current user's status for display and editing */
  myStatus?: {
    emoji: string | null;
    text: string | null;
    expiresAt: Date | null;
    dndEnabled: boolean;
  } | null;
}

export function WorkspaceSidebar({
  workspace,
  currentUserId,
  channels,
  conversations,
  categories,
  collapseStates,
  isAdmin = false,
  myStatus: initialStatus,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  // Local state for immediate UI updates after save/clear
  const [currentStatus, setCurrentStatus] = useState<UserStatusData | null | undefined>(initialStatus);
  const [statusOpen, setStatusOpen] = useState(false);

  const handleStatusSaved = (status: UserStatusData) => {
    setCurrentStatus(status);
    setStatusOpen(false);
  };

  const handleStatusCleared = () => {
    setCurrentStatus(null);
    setStatusOpen(false);
  };

  // Determine if we should use category view (when categories exist)
  const useCategoryView = categories && categories.length > 0;

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
          <Link
            href={`/${workspace.slug}/notes`}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
              pathname === `/${workspace.slug}/notes` && "bg-accent"
            )}
          >
            <StickyNote className="h-4 w-4" />
            My Notes
          </Link>
          {/* SCHD-02: Scheduled messages link in sidebar */}
          <Link
            href={`/${workspace.slug}/scheduled`}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
              pathname === `/${workspace.slug}/scheduled` && "bg-accent"
            )}
          >
            <Clock className="h-4 w-4" />
            Scheduled
          </Link>
          {/* RMND-03: Reminders link in sidebar with badge */}
          <Link
            href={`/${workspace.slug}/reminders`}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
              pathname === `/${workspace.slug}/reminders` && "bg-accent"
            )}
          >
            <Bell className="h-4 w-4" />
            Reminders
            <ReminderBadge />
          </Link>
          {/* BOOK-03: Saved items link in sidebar */}
          <Link
            href={`/${workspace.slug}/saved`}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors",
              pathname === `/${workspace.slug}/saved` && "bg-accent"
            )}
          >
            <Bookmark className="h-4 w-4" />
            Saved
          </Link>
        </div>

        {/* Channels section */}
        {useCategoryView ? (
          <>
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
            <div className="px-2">
              <CategorySidebar
                categories={categories}
                channels={channels.map((ch) => ({
                  ...ch,
                  categoryId: ch.categoryId ?? null,
                  sortOrder: ch.sortOrder ?? 0,
                }))}
                collapseStates={collapseStates ?? {}}
                workspaceSlug={workspace.slug}
                organizationId={workspace.id}
                isAdmin={isAdmin}
              />
            </div>
          </>
        ) : (
          <>
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
            {/* Create category button for admins when no categories exist */}
            {isAdmin && (
              <div className="px-3 pt-2">
                <CreateCategoryDialog
                  organizationId={workspace.id}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
                    >
                      <FolderPlus className="h-3 w-3 mr-2" />
                      New Category
                    </Button>
                  }
                />
              </div>
            )}
          </>
        )}
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

        {/* Archived channels section - at bottom of scrollable area */}
        <ArchivedChannelsSection
          organizationId={workspace.id}
          workspaceSlug={workspace.slug}
        />
      </div>

      {/* Footer */}
      <div className="p-3 border-t space-y-1 text-sm">
        {/* STAT-01: Status editor trigger */}
        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent w-full text-left transition-colors">
              {currentStatus?.emoji ? (
                <StatusDisplay emoji={currentStatus.emoji} text={currentStatus.text} />
              ) : (
                <Smile className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={currentStatus?.emoji || currentStatus?.text ? "" : "text-muted-foreground"}>
                {currentStatus?.text || "Set status"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0 w-auto">
            <StatusEditor
              currentStatus={currentStatus}
              onClose={() => setStatusOpen(false)}
              onStatusSaved={handleStatusSaved}
              onStatusCleared={handleStatusCleared}
            />
          </PopoverContent>
        </Popover>
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

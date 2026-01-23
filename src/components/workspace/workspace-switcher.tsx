"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceCard } from "./workspace-card";
import { useWorkspaceUnreadCounts } from "@/lib/hooks/use-workspace-unread";
import { Button } from "@/components/ui/button";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  memberCount: number;
  lastActivityAt: Date | null;
}

interface WorkspaceSwitcherProps {
  currentWorkspace: WorkspaceInfo;
  workspaces: WorkspaceInfo[];
}

/**
 * Dropdown menu for switching between workspaces.
 * Shows preview cards with unread counts, member counts, and last activity.
 */
export function WorkspaceSwitcher({
  currentWorkspace,
  workspaces,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch unread counts for all workspaces
  const workspaceIds = workspaces.map((ws) => ws.id);
  const { counts: unreadCounts, isLoading: unreadLoading } = useWorkspaceUnreadCounts(workspaceIds);

  const handleWorkspaceSelect = async (workspace: WorkspaceInfo) => {
    if (workspace.id === currentWorkspace.id) {
      // Already on this workspace, just close dropdown
      setIsOpen(false);
      return;
    }

    // Store last-visited path for current workspace before switching
    try {
      await fetch("/api/workspace/last-visited", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          path: window.location.pathname,
        }),
      });
    } catch (error) {
      console.error("Failed to store last-visited path:", error);
      // Continue with navigation anyway
    }

    // Navigate to the selected workspace
    // The layout will handle redirecting to last-visited or default
    setIsOpen(false);
    router.push(`/${workspace.slug}`);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 font-bold hover:bg-accent px-2 h-auto py-1"
        >
          <span className="truncate max-w-[150px]">{currentWorkspace.name}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>Your Workspaces</DropdownMenuLabel>

        <div className="py-1">
          {workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              unreadCount={unreadCounts[workspace.id] ?? 0}
              memberCount={workspace.memberCount}
              lastActivityAt={workspace.lastActivityAt}
              isActive={workspace.id === currentWorkspace.id}
              onClick={() => handleWorkspaceSelect(workspace)}
            />
          ))}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            href="/browse-workspaces"
            className="flex items-center gap-2 cursor-pointer"
          >
            <ExternalLink className="h-4 w-4" />
            Browse workspaces
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

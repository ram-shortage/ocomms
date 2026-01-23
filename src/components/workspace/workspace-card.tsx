"use client";

import { formatDistanceToNow } from "date-fns";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceCardProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
  };
  unreadCount: number;
  memberCount: number;
  lastActivityAt: Date | null;
  isActive: boolean;
  onClick?: () => void;
}

/**
 * Preview card for a workspace shown in the workspace switcher.
 * Displays workspace logo, name, unread badge, member count, and last activity.
 */
export function WorkspaceCard({
  workspace,
  unreadCount,
  memberCount,
  lastActivityAt,
  isActive,
  onClick,
}: WorkspaceCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent transition-colors text-left",
        isActive && "bg-accent/50"
      )}
    >
      {/* Workspace logo/placeholder */}
      <div className="flex-shrink-0">
        {workspace.logo ? (
          <img
            src={workspace.logo}
            alt={workspace.name}
            className="w-10 h-10 rounded-md object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center font-semibold text-primary">
            {workspace.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Workspace info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium truncate">{workspace.name}</span>
          {unreadCount > 0 && (
            <span className="flex-shrink-0 bg-destructive text-destructive-foreground text-xs font-semibold px-1.5 py-0.5 rounded">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {/* Member count */}
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{memberCount}</span>
          </div>

          {/* Last activity */}
          {lastActivityAt && (
            <span>
              {formatDistanceToNow(lastActivityAt, { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

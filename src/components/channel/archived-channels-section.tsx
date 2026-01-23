"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Archive, Hash, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getArchivedChannels } from "@/lib/actions/channel";

interface ArchivedChannel {
  id: string;
  name: string;
  slug: string;
  isPrivate: boolean;
}

interface ArchivedChannelsSectionProps {
  organizationId: string;
  workspaceSlug: string;
  /** External collapse control - when provided, disables internal collapse toggle */
  isCollapsed?: boolean;
  /** Callback when archive count is loaded - used to hide parent section when empty */
  onCountLoaded?: (count: number) => void;
}

export function ArchivedChannelsSection({
  organizationId,
  workspaceSlug,
  isCollapsed: externalCollapsed,
  onCountLoaded,
}: ArchivedChannelsSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const [channels, setChannels] = useState<ArchivedChannel[]>([]);
  const [loading, setLoading] = useState(true);

  // Use external collapse state if provided, otherwise use internal
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const hasExternalControl = externalCollapsed !== undefined;

  useEffect(() => {
    async function fetchArchived() {
      try {
        const archived = await getArchivedChannels(organizationId);
        const archivedChannels = archived.map((ch) => ({
          id: ch.id,
          name: ch.name,
          slug: ch.slug,
          isPrivate: ch.isPrivate,
        }));
        setChannels(archivedChannels);
        // Notify parent of count for visibility control
        onCountLoaded?.(archivedChannels.length);
      } catch (error) {
        console.error("Failed to fetch archived channels:", error);
        onCountLoaded?.(0);
      } finally {
        setLoading(false);
      }
    }
    fetchArchived();
  }, [organizationId, onCountLoaded]);

  // CONTEXT.md: Hidden entirely if no archived channels
  if (loading || channels.length === 0) {
    return null;
  }

  // When using external collapse control, render only the content (no header)
  if (hasExternalControl) {
    if (collapsed) {
      return null;
    }
    return (
      <nav className="space-y-1 px-2">
        {channels.map((channel) => (
          <Link
            key={channel.id}
            href={`/${workspaceSlug}/channels/${channel.slug}`}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-muted-foreground"
          >
            {channel.isPrivate ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Hash className="h-4 w-4" />
            )}
            <span className="truncate">{channel.name}</span>
          </Link>
        ))}
      </nav>
    );
  }

  // Default behavior with internal collapse control
  return (
    <div className="mt-2">
      {/* Section header - collapsible */}
      <button
        onClick={() => setInternalCollapsed(!internalCollapsed)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-accent/50 transition-colors rounded-md"
      >
        <div className="flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5" />
          <span>Archived</span>
          <span className="text-[10px] font-normal normal-case">({channels.length})</span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            internalCollapsed && "-rotate-90"
          )}
        />
      </button>

      {/* Channel list - shown when expanded */}
      {!internalCollapsed && (
        <nav className="space-y-1 mt-1">
          {channels.map((channel) => (
            <Link
              key={channel.id}
              href={`/${workspaceSlug}/channels/${channel.slug}`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-muted-foreground"
            >
              {channel.isPrivate ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Hash className="h-4 w-4" />
              )}
              <span className="truncate">{channel.name}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

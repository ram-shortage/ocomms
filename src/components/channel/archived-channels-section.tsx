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
}

export function ArchivedChannelsSection({
  organizationId,
  workspaceSlug,
}: ArchivedChannelsSectionProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [channels, setChannels] = useState<ArchivedChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArchived() {
      try {
        const archived = await getArchivedChannels(organizationId);
        setChannels(archived.map((ch) => ({
          id: ch.id,
          name: ch.name,
          slug: ch.slug,
          isPrivate: ch.isPrivate,
        })));
      } catch (error) {
        console.error("Failed to fetch archived channels:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchArchived();
  }, [organizationId]);

  // CONTEXT.md: Hidden entirely if no archived channels
  if (loading || channels.length === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      {/* Section header - collapsible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
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
            collapsed && "-rotate-90"
          )}
        />
      </button>

      {/* Channel list - shown when expanded */}
      {!collapsed && (
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

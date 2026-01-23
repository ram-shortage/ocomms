"use client";

import Link from "next/link";
import { Hash, Lock } from "lucide-react";
import { useUnreadCounts } from "@/lib/hooks/use-unread";

interface Channel {
  id: string;
  name: string;
  slug: string;
  isPrivate: boolean;
}

interface ChannelListClientProps {
  channels: Channel[];
  workspaceSlug: string;
}

export function ChannelListClient({
  channels,
  workspaceSlug,
}: ChannelListClientProps) {
  const channelIds = channels.map((c) => c.id);
  const { channelUnreads, isLoading } = useUnreadCounts(channelIds);

  return (
    <nav className="space-y-1">
      {channels.map((channel) => {
        const unreadCount = channelUnreads[channel.id] ?? 0;
        const hasUnreads = unreadCount > 0;

        return (
          <Link
            key={channel.id}
            href={`/${workspaceSlug}/channels/${channel.slug}`}
            className="flex items-center gap-2 px-3 py-1.5 min-h-11 md:min-h-8 text-sm rounded-md hover:bg-accent transition-colors"
          >
            {channel.isPrivate ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Hash className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={`truncate ${hasUnreads ? "font-semibold" : ""}`}>
              {channel.name}
            </span>
            {hasUnreads && !isLoading && (
              <span className="ml-auto bg-blue-600 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

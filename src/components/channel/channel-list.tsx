import Link from "next/link";
import { getUserChannels } from "@/lib/actions/channel";
import { Hash } from "lucide-react";

interface ChannelListProps {
  organizationId: string;
  workspaceSlug: string;
}

export async function ChannelList({
  organizationId,
  workspaceSlug,
}: ChannelListProps) {
  const channels = await getUserChannels(organizationId);

  if (channels.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        <p>No channels yet.</p>
        <Link
          href={`/${workspaceSlug}/channels`}
          className="text-blue-600 hover:underline"
        >
          Browse channels
        </Link>
      </div>
    );
  }

  return (
    <nav className="space-y-1">
      {channels.map((channel) => (
        <Link
          key={channel.id}
          href={`/${workspaceSlug}/channels/${channel.slug}`}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
        >
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{channel.name}</span>
        </Link>
      ))}
    </nav>
  );
}

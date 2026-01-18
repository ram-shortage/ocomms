import Link from "next/link";
import { getUserChannels } from "@/lib/actions/channel";
import { ChannelListClient } from "./channel-list-client";

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

  // Transform to minimal channel data for client component
  const channelData = channels.map((channel) => ({
    id: channel.id,
    name: channel.name,
    slug: channel.slug,
    isPrivate: channel.isPrivate,
  }));

  return (
    <ChannelListClient channels={channelData} workspaceSlug={workspaceSlug} />
  );
}

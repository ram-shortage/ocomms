"use client";

import { useState, useEffect } from "react";
import { getChannels, joinChannel } from "@/lib/actions/channel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash, Lock, Users } from "lucide-react";

interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPrivate: boolean;
  members: { userId: string }[];
}

interface ChannelDirectoryProps {
  organizationId: string;
  currentUserId: string;
}

export function ChannelDirectory({
  organizationId,
  currentUserId,
}: ChannelDirectoryProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    async function loadChannels() {
      try {
        const data = await getChannels(organizationId);
        setChannels(data);
      } catch (error) {
        console.error("Failed to load channels:", error);
      } finally {
        setLoading(false);
      }
    }
    loadChannels();
  }, [organizationId]);

  const handleJoin = async (channelId: string) => {
    setJoiningId(channelId);
    try {
      await joinChannel(channelId);
      // Refresh channels to update member status
      const data = await getChannels(organizationId);
      setChannels(data);
    } catch (error) {
      console.error("Failed to join channel:", error);
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading channels...
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No channels in this workspace yet.</p>
        <p className="text-sm mt-2">
          Create the first channel to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {channels.map((channel) => {
        const isMember = channel.members.some((m) => m.userId === currentUserId);

        return (
          <Card key={channel.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {channel.isPrivate ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Hash className="h-4 w-4 text-muted-foreground" />
                )}
                <CardTitle className="text-base">{channel.name}</CardTitle>
              </div>
              {channel.description && (
                <CardDescription className="line-clamp-2">
                  {channel.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {channel.members.length}{" "}
                    {channel.members.length === 1 ? "member" : "members"}
                  </span>
                </div>
                {isMember ? (
                  <span className="text-sm text-green-600 font-medium">
                    Joined
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleJoin(channel.id)}
                    disabled={joiningId === channel.id || channel.isPrivate}
                  >
                    {joiningId === channel.id ? "Joining..." : "Join"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import { MessageList, MessageInput, type MentionMember } from "@/components/message";
import type { Message } from "@/lib/socket-events";
import { useMarkAsRead, useMarkMessageUnread } from "@/lib/hooks/use-unread";

interface ChannelContentProps {
  channelId: string;
  initialMessages: Message[];
  initialPinnedMessageIds: string[];
  currentUserId: string;
  currentUsername?: string;
  members: MentionMember[];
}

export function ChannelContent({
  channelId,
  initialMessages,
  initialPinnedMessageIds,
  currentUserId,
  currentUsername,
  members,
}: ChannelContentProps) {
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(
    () => new Set(initialPinnedMessageIds)
  );

  // Unread management hooks
  const markAsRead = useMarkAsRead();
  const markMessageUnread = useMarkMessageUnread();

  // Re-sync when initial props change (e.g., navigation)
  useEffect(() => {
    setPinnedMessageIds(new Set(initialPinnedMessageIds));
  }, [initialPinnedMessageIds]);

  // Mark channel as read when navigating to it
  useEffect(() => {
    markAsRead(channelId);
  }, [channelId, markAsRead]);

  const handlePin = useCallback(
    async (messageId: string) => {
      // Optimistic update
      setPinnedMessageIds((prev) => new Set([...prev, messageId]));

      const res = await fetch(`/api/channels/${channelId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });

      if (!res.ok) {
        // Revert on failure
        setPinnedMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [channelId]
  );

  const handleUnpin = useCallback(
    async (messageId: string) => {
      // Optimistic update
      setPinnedMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });

      const res = await fetch(`/api/channels/${channelId}/pins?messageId=${messageId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        // Revert on failure
        setPinnedMessageIds((prev) => new Set([...prev, messageId]));
      }
    },
    [channelId]
  );

  return (
    <>
      {/* Message list - grows to fill available space */}
      <MessageList
        initialMessages={initialMessages}
        targetId={channelId}
        targetType="channel"
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        pinnedMessageIds={pinnedMessageIds}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onMarkUnread={markMessageUnread}
      />

      {/* Message input - fixed at bottom */}
      <MessageInput targetId={channelId} targetType="channel" members={members} />
    </>
  );
}

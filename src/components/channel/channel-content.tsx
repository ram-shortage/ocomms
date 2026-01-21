"use client";

import { useState, useCallback, useEffect } from "react";
import { Archive } from "lucide-react";
import { MessageList, MessageInput, type MentionMember, type MentionGroup } from "@/components/message";
import type { Message } from "@/lib/socket-events";
import { useMarkAsRead, useMarkMessageUnread } from "@/lib/hooks/use-unread";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CustomEmojiData {
  id: string;
  name: string;
  path: string;
  isAnimated: boolean;
}

interface ChannelContentProps {
  channelId: string;
  organizationId: string;
  initialMessages: Message[];
  initialPinnedMessageIds: string[];
  currentUserId: string;
  currentUsername?: string;
  members: MentionMember[];
  groups?: MentionGroup[];
  isArchived?: boolean;
  customEmojis?: CustomEmojiData[];
}

export function ChannelContent({
  channelId,
  organizationId,
  initialMessages,
  initialPinnedMessageIds,
  currentUserId,
  currentUsername,
  members,
  groups = [],
  isArchived = false,
  customEmojis = [],
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Archived channel banner */}
      {isArchived && (
        <Alert className="mx-4 mt-4 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 shrink-0">
          <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            This channel is archived. Messages are read-only.
          </AlertDescription>
        </Alert>
      )}

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
        className={isArchived ? "opacity-75" : ""}
        customEmojis={customEmojis}
        groupHandles={groups.map((g) => ({ handle: g.handle }))}
        organizationId={organizationId}
      />

      {/* Message input - fixed at bottom, hidden for archived channels */}
      {!isArchived && (
        <div className="shrink-0">
          <MessageInput targetId={channelId} targetType="channel" members={members} groups={groups} customEmojis={customEmojis} />
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { MessageList, MessageInput, type MentionMember } from "@/components/message";
import type { Message } from "@/lib/socket-events";
import { useMarkAsRead, useMarkMessageUnread } from "@/lib/hooks/use-unread";

interface DMContentProps {
  conversationId: string;
  initialMessages: Message[];
  currentUserId: string;
  currentUsername?: string;
  members: MentionMember[];
}

export function DMContent({
  conversationId,
  initialMessages,
  currentUserId,
  currentUsername,
  members,
}: DMContentProps) {
  // Unread management hooks
  const markAsRead = useMarkAsRead();
  const markMessageUnread = useMarkMessageUnread();

  // Mark conversation as read when navigating to it
  useEffect(() => {
    markAsRead(undefined, conversationId);
  }, [conversationId, markAsRead]);

  return (
    <>
      {/* Message list - grows to fill available space */}
      <MessageList
        initialMessages={initialMessages}
        targetId={conversationId}
        targetType="dm"
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        onMarkUnread={markMessageUnread}
      />

      {/* Message input - fixed at bottom */}
      <MessageInput targetId={conversationId} targetType="dm" members={members} />
    </>
  );
}

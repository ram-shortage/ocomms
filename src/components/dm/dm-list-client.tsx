"use client";

import { DMListItem } from "./dm-list-item";

interface Conversation {
  id: string;
  otherUser: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  lastMessageAt: Date | null;
}

interface DMListClientProps {
  conversations: Conversation[];
  workspaceSlug: string;
}

export function DMListClient({
  conversations,
  workspaceSlug,
}: DMListClientProps) {
  if (conversations.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        No direct messages yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conversation) => (
        <DMListItem
          key={conversation.id}
          conversationId={conversation.id}
          workspaceSlug={workspaceSlug}
          isGroup={false}
          displayName={conversation.otherUser.name || conversation.otherUser.email}
          otherUserId={conversation.otherUser.id}
        />
      ))}
    </div>
  );
}

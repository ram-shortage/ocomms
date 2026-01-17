"use client";

import Link from "next/link";
import { PresenceIndicator, usePresence } from "@/components/presence";

interface Participant {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface DMListItemProps {
  conversationId: string;
  workspaceSlug: string;
  isGroup: boolean;
  displayName: string;
  /** For 1:1 DMs, the other participant's userId */
  otherUserId?: string;
  /** For group DMs, count of participants */
  participantCount?: number;
}

/**
 * Single DM list item with presence indicator.
 * For 1:1 DMs, shows the other user's presence.
 * For group DMs, shows participant count instead.
 */
export function DMListItem({
  conversationId,
  workspaceSlug,
  isGroup,
  displayName,
  otherUserId,
  participantCount = 0,
}: DMListItemProps) {
  const { getPresence } = usePresence();

  return (
    <Link
      href={`/${workspaceSlug}/dm/${conversationId}`}
      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100"
    >
      {isGroup ? (
        <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-medium">
          {participantCount}
        </div>
      ) : (
        <div className="relative">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
            {displayName[0].toUpperCase()}
          </div>
          {otherUserId && (
            <PresenceIndicator
              status={getPresence(otherUserId)}
              size="sm"
              className="absolute -bottom-0.5 -right-0.5"
            />
          )}
        </div>
      )}
      <span className="text-sm truncate">{displayName}</span>
    </Link>
  );
}

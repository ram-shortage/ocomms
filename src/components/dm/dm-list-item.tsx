"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { PresenceIndicator, usePresence } from "@/components/presence";
import { cn } from "@/lib/utils";

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
 * Sortable DM list item with drag handle and presence indicator.
 * For 1:1 DMs, shows the other user's presence.
 * For group DMs, shows participant count instead.
 */
export function SortableDMListItem({
  conversationId,
  workspaceSlug,
  isGroup,
  displayName,
  otherUserId,
  participantCount = 0,
}: DMListItemProps) {
  const { getPresence } = usePresence();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: conversationId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center",
        isDragging && "opacity-50"
      )}
    >
      {/* Drag handle - hidden by default, visible on hover */}
      <button
        className="opacity-0 group-hover:opacity-100 p-1 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <Link
        href={`/${workspaceSlug}/dm/${conversationId}`}
        className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted"
      >
        {isGroup ? (
          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium">
            {participantCount}
          </div>
        ) : (
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
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
    </div>
  );
}

/**
 * DM item overlay for drag preview (non-sortable).
 */
export function DMListItemOverlay({
  displayName,
  isGroup,
  participantCount = 0,
}: {
  displayName: string;
  isGroup: boolean;
  participantCount?: number;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-accent shadow-lg">
      {isGroup ? (
        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs font-medium">
          {participantCount}
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
          {displayName[0].toUpperCase()}
        </div>
      )}
      <span className="text-sm truncate">{displayName}</span>
    </div>
  );
}

/**
 * Legacy export for backward compatibility - re-export as DMListItem.
 * Components not using drag-and-drop can continue to use this.
 */
export { SortableDMListItem as DMListItem };

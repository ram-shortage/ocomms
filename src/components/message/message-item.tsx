"use client";

import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Message, ReactionGroup } from "@/lib/socket-events";
import { ReactionPicker } from "./reaction-picker";
import { ReactionDisplay } from "./reaction-display";

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  onDelete: (messageId: string) => void;
  reactions: ReactionGroup[];
  onToggleReaction: (messageId: string, emoji: string) => void;
}

export function MessageItem({
  message,
  currentUserId,
  onDelete,
  reactions,
  onToggleReaction,
}: MessageItemProps) {
  const isOwn = message.authorId === currentUserId;
  const isDeleted = message.deletedAt !== null && message.deletedAt !== undefined;

  return (
    <div className="group flex items-start gap-3 py-2 px-4 hover:bg-gray-50 rounded-lg">
      {/* Avatar placeholder */}
      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium shrink-0">
        {message.author?.name?.[0]?.toUpperCase() || message.author?.email?.[0]?.toUpperCase() || "?"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-gray-900">
            {message.author?.name || message.author?.email || "Unknown"}
          </span>
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
        </div>

        {isDeleted ? (
          <p className="text-gray-400 italic text-sm">[Message deleted]</p>
        ) : (
          <>
            <p className="text-gray-700 whitespace-pre-wrap break-words">{message.content}</p>
            <ReactionDisplay
              reactions={reactions}
              currentUserId={currentUserId}
              onToggle={(emoji) => onToggleReaction(message.id, emoji)}
            />
          </>
        )}
      </div>

      {/* Action buttons - visible on hover for non-deleted messages */}
      {!isDeleted && (
        <div className="flex items-center gap-1">
          <ReactionPicker onSelectEmoji={(emoji) => onToggleReaction(message.id, emoji)} />
          {isOwn && (
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-gray-400 hover:text-red-500"
              onClick={() => onDelete(message.id)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete message</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { formatDistanceToNow } from "date-fns";
import { Trash2, MessageSquare, Pin, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Message, ReactionGroup } from "@/lib/socket-events";
import type { SendStatus } from "@/lib/cache";
import { ReactionPicker } from "./reaction-picker";
import { ReactionDisplay } from "./reaction-display";
import { MessageContent } from "./message-content";
import { MessageStatus } from "./message-status";
import { FileAttachment } from "./file-attachment";
import { LinkPreviewCard } from "./link-preview-card";
import { ReminderMenuItem } from "@/components/reminder/reminder-menu-item";
import { BookmarkButton } from "@/components/bookmark/bookmark-button";
import { StatusDisplay } from "@/components/status/status-display";

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  currentUsername?: string;
  onDelete: (messageId: string) => void;
  reactions: ReactionGroup[];
  onToggleReaction: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
  isPinned?: boolean;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  isChannelMessage?: boolean;
  onMarkUnread?: (messageId: string) => void;
  sendStatus?: SendStatus;
  retryCount?: number;
  onRetry?: () => void;
  hasReminder?: boolean;
  /** STAT-02: Author's custom status for display next to name */
  authorStatus?: { emoji: string | null; text: string | null } | null;
  /** LINK-01: Link previews for this message */
  linkPreviews?: Array<{
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    siteName: string | null;
  }>;
  /** LINK-06: Callback when user hides a preview */
  onHidePreview?: (messageId: string, previewId: string) => void;
}

export function MessageItem({
  message,
  currentUserId,
  currentUsername,
  onDelete,
  reactions,
  onToggleReaction,
  onReply,
  isPinned = false,
  onPin,
  onUnpin,
  isChannelMessage = false,
  onMarkUnread,
  sendStatus,
  retryCount,
  onRetry,
  hasReminder = false,
  authorStatus,
  linkPreviews,
  onHidePreview,
}: MessageItemProps) {
  const isOwn = message.authorId === currentUserId;
  const isDeleted = message.deletedAt !== null && message.deletedAt !== undefined;
  const isThreaded = message.parentId !== null && message.parentId !== undefined;
  const hasReplies = (message.replyCount ?? 0) > 0;
  const isPending = sendStatus === "pending" || sendStatus === "sending";

  return (
    <div className={`group flex items-start gap-3 py-2 px-4 hover:bg-muted rounded-lg ${isPending ? "opacity-70" : ""}`}>
      {/* Avatar placeholder */}
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium shrink-0">
        {message.author?.name?.[0]?.toUpperCase() || message.author?.email?.[0]?.toUpperCase() || "?"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-foreground">
            {message.author?.name || message.author?.email || "Unknown"}
          </span>
          {/* STAT-02: Show author status emoji next to name */}
          {authorStatus?.emoji && (
            <StatusDisplay emoji={authorStatus.emoji} text={authorStatus.text} />
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
        </div>

        {isDeleted ? (
          <p className="text-muted-foreground italic text-sm">[Message deleted]</p>
        ) : (
          <>
            <MessageContent content={message.content} currentUsername={currentUsername} />
            {/* LINK-01: Link previews */}
            {linkPreviews && linkPreviews.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {linkPreviews.map((preview) => (
                  <LinkPreviewCard
                    key={preview.id}
                    preview={preview}
                    canHide={isOwn}
                    onHide={(previewId) => onHidePreview?.(message.id, previewId)}
                  />
                ))}
              </div>
            )}
            {/* FILE-04/FILE-05: Render file attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {message.attachments.map((attachment) => (
                  <FileAttachment key={attachment.id} attachment={attachment} />
                ))}
              </div>
            )}
            <ReactionDisplay
              reactions={reactions}
              currentUserId={currentUserId}
              onToggle={(emoji) => onToggleReaction(message.id, emoji)}
            />
            <MessageStatus
              status={sendStatus}
              retryCount={retryCount}
              onRetry={onRetry}
            />
          </>
        )}
      </div>

      {/* Action buttons - visible on hover for non-deleted messages */}
      {!isDeleted && (
        <div className="flex items-center gap-1">
          <ReactionPicker onSelectEmoji={(emoji) => onToggleReaction(message.id, emoji)} />
          {/* RMND-01: Remind me button - highlighted if reminder exists */}
          <ReminderMenuItem messageId={message.id} hasReminder={hasReminder} />
          {/* BOOK-01: Bookmark button */}
          <BookmarkButton messageId={message.id} />
          {/* Mark as unread - only for other users' messages */}
          {!isOwn && onMarkUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-muted-foreground hover:text-primary"
              onClick={() => onMarkUnread(message.id)}
            >
              <EyeOff className="h-4 w-4" />
              <span className="sr-only">Mark as unread</span>
            </Button>
          )}
          {/* Pin button - only for channel messages (not DMs) */}
          {isChannelMessage && (onPin || onUnpin) && (
            <Button
              variant="ghost"
              size="sm"
              className={`transition-opacity h-7 w-7 p-0 ${
                isPinned
                  ? "opacity-100 text-amber-500 hover:text-amber-600"
                  : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-amber-500"
              }`}
              onClick={() =>
                isPinned
                  ? onUnpin?.(message.id)
                  : onPin?.(message.id)
              }
            >
              <Pin className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`} />
              <span className="sr-only">{isPinned ? "Unpin message" : "Pin message"}</span>
            </Button>
          )}
          {/* Reply button - only for top-level messages (no nested threading) */}
          {!isThreaded && onReply && (
            <Button
              variant="ghost"
              size="sm"
              className={`transition-opacity h-7 p-0 px-1.5 text-muted-foreground hover:text-primary ${
                hasReplies ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              onClick={() => onReply(message.id)}
            >
              <MessageSquare className="h-4 w-4" />
              {hasReplies && (
                <span className="ml-1 text-xs">{message.replyCount}</span>
              )}
              <span className="sr-only">Reply in thread</span>
            </Button>
          )}
          {isOwn && (
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
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

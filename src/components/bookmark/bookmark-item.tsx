"use client";

import { useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { X, ExternalLink, Hash, AtSign, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { removeBookmark } from "@/lib/actions/bookmark";
import { toast } from "sonner";

interface BookmarkItemProps {
  bookmark: {
    id: string;
    type: "message" | "file";
    createdAt: Date;
    message?: {
      id: string;
      content: string;
      channelId: string | null;
      conversationId: string | null;
      author: {
        id: string;
        name: string | null;
        email: string;
      } | null;
      channel?: {
        id: string;
        slug: string;
        name: string;
      } | null;
    } | null;
    file?: {
      id: string;
      filename: string;
      mimeType: string;
      uploader: {
        id: string;
        name: string | null;
        email: string;
      } | null;
      message?: {
        channel?: {
          id: string;
          slug: string;
          name: string;
        } | null;
      } | null;
    } | null;
  };
  onRemove?: (bookmarkId: string) => void;
}

export function BookmarkItem({ bookmark, onRemove }: BookmarkItemProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      try {
        await removeBookmark(bookmark.id);
        onRemove?.(bookmark.id);
        toast.success("Removed from saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to remove bookmark");
      }
    });
  };

  const handleClick = () => {
    // Navigate to original message location (BOOK-05)
    if (bookmark.type === "message" && bookmark.message) {
      if (bookmark.message.channelId && bookmark.message.channel?.slug) {
        router.push(`/${workspaceSlug}/channels/${bookmark.message.channel.slug}`);
      } else if (bookmark.message.conversationId) {
        router.push(`/${workspaceSlug}/dm/${bookmark.message.conversationId}`);
      }
    } else if (bookmark.type === "file" && bookmark.file) {
      // Navigate to channel where file was posted
      const channel = bookmark.file.message?.channel;
      if (channel?.slug) {
        router.push(`/${workspaceSlug}/channels/${channel.slug}`);
      }
    }
  };

  // Render based on bookmark type
  if (bookmark.type === "message" && bookmark.message) {
    const message = bookmark.message;
    const messagePreview = message.content.slice(0, 80) + (message.content.length > 80 ? "..." : "");
    const authorName = message.author?.name || message.author?.email || "Unknown";
    const channelName = message.channel?.name;
    const isDM = !!message.conversationId;

    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors group"
      >
        <div className="flex items-start gap-2">
          {isDM ? (
            <AtSign className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          ) : (
            <Hash className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          )}
          <div className="flex-1 min-w-0">
            {/* Message preview */}
            <p className="text-sm truncate">{messagePreview}</p>

            {/* Context info */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                from {authorName}
              </span>
              {channelName && (
                <span className="text-xs text-muted-foreground">
                  in #{channelName}
                </span>
              )}
              {isDM && (
                <span className="text-xs text-muted-foreground">
                  in DM
                </span>
              )}
            </div>

            {/* Saved time */}
            <p className="text-xs text-muted-foreground mt-1">
              Saved {formatDistanceToNow(new Date(bookmark.createdAt), { addSuffix: true })}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
              onClick={handleRemove}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Remove from saved</span>
            </Button>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </button>
    );
  }

  // File bookmark
  if (bookmark.type === "file" && bookmark.file) {
    const file = bookmark.file;
    const uploaderName = file.uploader?.name || file.uploader?.email || "Unknown";
    const channelName = file.message?.channel?.name;

    return (
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors group"
      >
        <div className="flex items-start gap-2">
          <FileIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            {/* Filename */}
            <p className="text-sm truncate">{file.filename}</p>

            {/* Context info */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                from {uploaderName}
              </span>
              {channelName && (
                <span className="text-xs text-muted-foreground">
                  in #{channelName}
                </span>
              )}
            </div>

            {/* Saved time */}
            <p className="text-xs text-muted-foreground mt-1">
              Saved {formatDistanceToNow(new Date(bookmark.createdAt), { addSuffix: true })}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
              onClick={handleRemove}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Remove from saved</span>
            </Button>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </button>
    );
  }

  // Fallback for invalid bookmark
  return null;
}

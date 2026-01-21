"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleBookmark } from "@/lib/actions/bookmark";
import { toast } from "sonner";

interface BookmarkButtonProps {
  messageId: string;
  initialBookmarked?: boolean;
}

export function BookmarkButton({ messageId, initialBookmarked = false }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    // Optimistic update
    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked);

    startTransition(async () => {
      try {
        const result = await toggleBookmark({ type: "message", messageId });
        setIsBookmarked(result.bookmarked);
        toast.success(result.bookmarked ? "Message saved" : "Message unsaved");
      } catch (error) {
        // Revert on error
        setIsBookmarked(previousState);
        toast.error(error instanceof Error ? error.message : "Failed to toggle bookmark");
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`transition-opacity h-7 w-7 p-0 ${
        isBookmarked
          ? "opacity-100 text-yellow-500 hover:text-yellow-600"
          : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-500"
      }`}
      onClick={handleToggle}
      disabled={isPending}
    >
      <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
      <span className="sr-only">{isBookmarked ? "Remove from saved" : "Save message"}</span>
    </Button>
  );
}

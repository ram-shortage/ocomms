"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { getBookmarks } from "@/lib/actions/bookmark";
import { BookmarkItem } from "./bookmark-item";

type BookmarkType = Awaited<ReturnType<typeof getBookmarks>>[number];

interface BookmarkListProps {
  initialBookmarks?: BookmarkType[];
}

export function BookmarkList({ initialBookmarks }: BookmarkListProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>(initialBookmarks ?? []);
  const [loading, setLoading] = useState(!initialBookmarks);

  useEffect(() => {
    if (initialBookmarks) return;

    const fetchBookmarks = async () => {
      try {
        const data = await getBookmarks();
        setBookmarks(data);
      } catch (error) {
        console.error("Failed to fetch bookmarks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookmarks();
  }, [initialBookmarks]);

  const handleRemove = (bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading saved items...
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Bookmark className="h-8 w-8 mb-2 opacity-50" />
        <p>No saved items yet</p>
        <p className="text-xs mt-1">Bookmark messages to find them here</p>
      </div>
    );
  }

  // Separate message and file bookmarks
  const messageBookmarks = bookmarks.filter((b) => b.type === "message");
  const fileBookmarks = bookmarks.filter((b) => b.type === "file");

  return (
    <div className="space-y-4">
      {/* Message bookmarks */}
      {messageBookmarks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Messages
          </h3>
          <div className="space-y-1">
            {messageBookmarks.map((bookmark) => (
              <BookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      )}

      {/* File bookmarks */}
      {fileBookmarks.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Files
          </h3>
          <div className="space-y-1">
            {fileBookmarks.map((bookmark) => (
              <BookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

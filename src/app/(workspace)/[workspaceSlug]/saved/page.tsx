"use client";

import { Bookmark } from "lucide-react";
import { BookmarkList } from "@/components/bookmark/bookmark-list";

export default function SavedItemsPage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Saved Items</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Messages and files you&apos;ve saved for later
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <BookmarkList />
      </div>
    </div>
  );
}

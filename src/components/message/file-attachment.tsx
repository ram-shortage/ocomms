"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { FileText, File, Download, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleBookmark } from "@/lib/actions/bookmark";

/**
 * Format bytes to human-readable string (KB, MB, etc.)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get appropriate icon for file type based on mime type.
 */
function getFileIcon(mimeType: string) {
  if (mimeType.includes("pdf")) {
    return FileText;
  }
  return File;
}

export interface FileAttachmentProps {
  attachment: {
    id: string;
    originalName: string;
    path: string;
    mimeType: string;
    sizeBytes: number;
    isImage: boolean;
  };
}

/**
 * Display component for file attachments in messages.
 *
 * - Images display as inline previews (max 400x300) with click to open full size
 * - Non-images display as download cards with icon, filename, size, and download button
 * - Both types have a bookmark button on hover
 *
 * FILE-04: Image files display inline preview
 * FILE-05: Non-image files display as download link with filename and size
 * BOOK-02: Save files to personal saved list
 */
export function FileAttachment({ attachment }: FileAttachmentProps) {
  const { id, originalName, path, mimeType, sizeBytes, isImage } = attachment;
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked);
    startTransition(async () => {
      try {
        const result = await toggleBookmark({
          type: "file",
          fileId: id,
        });
        setIsBookmarked(result.bookmarked);
      } catch (error) {
        setIsBookmarked(previousState); // Revert on error
        console.error("Failed to toggle file bookmark:", error);
      }
    });
  };

  // Image preview (FILE-04)
  if (isImage) {
    return (
      <div className="relative group max-w-[400px]">
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
        >
          <Image
            src={path}
            alt={originalName}
            width={400}
            height={300}
            className="object-contain max-h-[300px] w-auto"
            unoptimized // External/uploaded images may not be in Next.js image domains
          />
        </a>
        {/* Bookmark button for images */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleBookmark}
          disabled={isPending}
          className={cn(
            "absolute top-2 right-2 h-7 w-7 p-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity",
            isBookmarked && "text-yellow-500 opacity-100"
          )}
        >
          <Bookmark
            className={cn("h-4 w-4", isBookmarked && "fill-current")}
          />
          <span className="sr-only">
            {isBookmarked ? "Remove from saved" : "Save file"}
          </span>
        </Button>
      </div>
    );
  }

  // Non-image file card (FILE-05)
  const IconComponent = getFileIcon(mimeType);

  return (
    <div className="relative group max-w-[320px]">
      <a
        href={path}
        download={originalName}
        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-md bg-muted flex items-center justify-center">
          <IconComponent className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium text-foreground truncate"
            title={originalName}
          >
            {originalName}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(sizeBytes)}
          </p>
        </div>
        <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </a>
      {/* Bookmark button for non-image files */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleBookmark}
        disabled={isPending}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-10 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity",
          isBookmarked && "text-yellow-500 opacity-100"
        )}
      >
        <Bookmark
          className={cn("h-4 w-4", isBookmarked && "fill-current")}
        />
        <span className="sr-only">
          {isBookmarked ? "Remove from saved" : "Save file"}
        </span>
      </Button>
    </div>
  );
}

"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LinkPreviewCardProps {
  preview: {
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    siteName: string | null;
  };
  canHide: boolean; // True if current user sent this message
  onHide?: (previewId: string) => void;
}

export function LinkPreviewCard({ preview, canHide, onHide }: LinkPreviewCardProps) {
  // Extract domain for display (CONTEXT: show domain text on cards)
  const domain = (() => {
    try {
      return new URL(preview.url).hostname.replace('www.', '');
    } catch {
      return preview.url;
    }
  })();

  // Skip rendering if no meaningful content
  if (!preview.title && !preview.description && !preview.imageUrl) {
    return null;
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/preview relative block mt-2 max-w-md border rounded-lg overflow-hidden hover:bg-muted/50 transition-colors"
      onClick={(e) => e.stopPropagation()} // Prevent parent click handlers
    >
      <div className="flex">
        {/* Text content */}
        <div className="flex-1 p-3 min-w-0">
          {/* Site name / domain */}
          <div className="text-xs text-muted-foreground mb-1">
            {preview.siteName || domain}
          </div>

          {/* Title */}
          {preview.title && (
            <div className="font-medium text-sm text-foreground line-clamp-2 mb-1">
              {preview.title}
            </div>
          )}

          {/* Description (2-3 lines per CONTEXT) */}
          {preview.description && (
            <div className="text-xs text-muted-foreground line-clamp-3">
              {preview.description}
            </div>
          )}
        </div>

        {/* Thumbnail image (respect aspect ratio per CONTEXT) */}
        {preview.imageUrl && (
          <div className="w-24 h-24 shrink-0 bg-muted">
            <img
              src={preview.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      {/* Hide button (X) for own messages - LINK-06 */}
      {canHide && onHide && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/preview:opacity-100 bg-background/80"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onHide(preview.id);
          }}
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Hide preview</span>
        </Button>
      )}
    </a>
  );
}

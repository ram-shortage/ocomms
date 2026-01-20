"use client";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, FileIcon, ImageIcon } from "lucide-react";

interface UploadProgressProps {
  filename: string;
  progress: number; // 0-100
  isImage?: boolean;
  onCancel?: () => void;
}

export function UploadProgress({
  filename,
  progress,
  isImage = false,
  onCancel,
}: UploadProgressProps) {
  // Truncate long filenames
  const displayName = filename.length > 30
    ? filename.slice(0, 15) + "..." + filename.slice(-12)
    : filename;

  const Icon = isImage ? ImageIcon : FileIcon;

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm truncate" title={filename}>
            {displayName}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {progress}%
          </span>
        </div>
        <Progress value={progress} className="h-1.5" indicatorClassName="bg-primary" />
      </div>
      {onCancel && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-6 w-6 shrink-0"
          title="Cancel upload"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Cancel upload</span>
        </Button>
      )}
    </div>
  );
}

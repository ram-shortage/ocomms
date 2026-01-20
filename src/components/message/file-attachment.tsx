"use client";

import Image from "next/image";
import { FileText, File, Download } from "lucide-react";

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
 *
 * FILE-04: Image files display inline preview
 * FILE-05: Non-image files display as download link with filename and size
 */
export function FileAttachment({ attachment }: FileAttachmentProps) {
  const { originalName, path, mimeType, sizeBytes, isImage } = attachment;

  // Image preview (FILE-04)
  if (isImage) {
    return (
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-[400px] rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
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
    );
  }

  // Non-image file card (FILE-05)
  const IconComponent = getFileIcon(mimeType);

  return (
    <a
      href={path}
      download={originalName}
      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors max-w-[320px]"
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
  );
}

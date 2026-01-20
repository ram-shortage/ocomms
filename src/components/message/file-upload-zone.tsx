"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

const MAX_FILES_PER_UPLOAD = 5;

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUploadZone({ onFilesSelected, disabled = false }: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      // Limit to MAX_FILES_PER_UPLOAD files per drop
      const filesToUpload = droppedFiles.slice(0, MAX_FILES_PER_UPLOAD);
      onFilesSelected(filesToUpload);
    }
  }, [disabled, onFilesSelected]);

  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      // Limit to MAX_FILES_PER_UPLOAD files per selection
      const filesToUpload = Array.from(selectedFiles).slice(0, MAX_FILES_PER_UPLOAD);
      onFilesSelected(filesToUpload);
    }
    // Reset input to allow selecting the same file again
    e.target.value = "";
  }, [onFilesSelected]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "transition-colors",
        isDragOver && "ring-2 ring-primary ring-inset bg-primary/5 rounded-md"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload files"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={disabled}
        className="h-11 w-11 shrink-0"
        title="Attach files"
      >
        <Paperclip className="h-5 w-5" />
        <span className="sr-only">Attach files</span>
      </Button>
    </div>
  );
}

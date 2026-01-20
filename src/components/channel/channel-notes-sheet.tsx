"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NoteEditor } from "@/components/notes/note-editor";
import { getSocket } from "@/lib/socket-client";
import { toast } from "sonner";

interface ChannelNotesSheetProps {
  /** Channel ID for fetching/saving notes */
  channelId: string;
  /** Channel name for display in header */
  channelName: string;
  /** Optional custom trigger element */
  trigger?: React.ReactNode;
}

/**
 * Slide-out sheet containing the channel notes editor.
 * Handles socket subscription for real-time update notifications.
 */
export function ChannelNotesSheet({
  channelId,
  channelName,
  trigger,
}: ChannelNotesSheetProps) {
  const [open, setOpen] = useState(false);

  // Handle sheet open/close for socket subscription
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    const socket = getSocket();

    if (isOpen) {
      // Subscribe to note updates when sheet opens
      socket.emit("note:subscribe", { channelId });
    } else {
      // Unsubscribe when sheet closes
      socket.emit("note:unsubscribe", { channelId });
    }
  }, [channelId]);

  // Listen for real-time note updates
  useEffect(() => {
    if (!open) return;

    const socket = getSocket();

    const handleNoteUpdated = (data: {
      channelId?: string;
      version: number;
      updatedBy: string;
      updatedByName: string;
    }) => {
      // Only handle updates for this channel
      if (data.channelId !== channelId) return;

      // Show toast notification that someone else updated
      // The NoteEditor's conflict detection will handle the case
      // where both users try to save - no need to auto-refresh
      toast.info(`${data.updatedByName} updated the notes`);
    };

    socket.on("note:updated", handleNoteUpdated);

    return () => {
      socket.off("note:updated", handleNoteUpdated);
    };
  }, [open, channelId]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Notes</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[600px] sm:max-w-[600px] flex flex-col p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle>#{channelName} Notes</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <NoteEditor
            noteType="channel"
            channelId={channelId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

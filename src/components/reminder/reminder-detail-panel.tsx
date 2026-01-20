"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, Check, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { completeReminder, cancelReminder } from "@/lib/actions/reminder";
import { SnoozeOptions } from "./snooze-options";

interface ReminderDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: {
    id: string;
    note: string | null;
    remindAt: Date;
    status: "pending" | "fired" | "snoozed" | "completed" | "cancelled";
    recurringPattern: "daily" | "weekly" | null;
    snoozedUntil: Date | null;
    message: {
      id: string;
      content: string;
      channelId: string | null;
      conversationId: string | null;
      author: {
        id: string;
        name: string | null;
        email: string;
      } | null;
    };
  } | null;
  workspaceSlug?: string;
  channelSlug?: string;
}

export function ReminderDetailPanel({
  isOpen,
  onClose,
  reminder,
  workspaceSlug,
}: ReminderDetailPanelProps) {
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  if (!reminder) return null;

  const authorName = reminder.message.author?.name || reminder.message.author?.email || "Unknown";
  const isFired = reminder.status === "fired";

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);

    try {
      await completeReminder(reminder.id);
      toast.success("Reminder marked as complete");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete reminder");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);

    try {
      await cancelReminder(reminder.id);
      toast.success("Reminder cancelled");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel reminder");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleGoToMessage = () => {
    if (!workspaceSlug) {
      toast.error("Unable to navigate to message");
      return;
    }

    // Navigate to the message location
    // For channels: /{workspaceSlug}/channels/{channelSlug}?message={messageId}
    // For DMs: /{workspaceSlug}/dm/{conversationId}?message={messageId}
    // Note: We don't have channelSlug here, so we might need to look it up
    // For now, navigate and let the page handle scroll to message
    if (reminder.message.channelId) {
      // We'd need to look up the channel slug, for now just close
      toast.info("Navigate to the channel to view the message");
    } else if (reminder.message.conversationId) {
      router.push(`/${workspaceSlug}/dm/${reminder.message.conversationId}`);
    }
    onClose();
  };

  // Determine display time
  const displayTime = reminder.status === "snoozed" && reminder.snoozedUntil
    ? reminder.snoozedUntil
    : reminder.remindAt;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[450px] p-0 flex flex-col" side="right">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className={`h-4 w-4 ${isFired ? "text-amber-500" : ""}`} />
              Reminder
            </SheetTitle>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status banner for fired reminders */}
          {isFired && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                This reminder needs your attention
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Fired {formatDistanceToNow(new Date(reminder.remindAt), { addSuffix: true })}
              </p>
            </div>
          )}

          {/* Message content */}
          <div className="bg-muted rounded-md p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-muted-foreground text-xs font-medium shrink-0">
                {authorName[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">{authorName}</span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                  {reminder.message.content}
                </p>
              </div>
            </div>
          </div>

          {/* Reminder note */}
          {reminder.note && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Your note
              </h4>
              <p className="text-sm bg-muted/50 rounded-md p-3">
                {reminder.note}
              </p>
            </div>
          )}

          {/* Scheduled time */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {reminder.status === "snoozed" ? "Snoozed until" : "Scheduled for"}
            </h4>
            <div className="flex items-center gap-2">
              <p className="text-sm">
                {format(new Date(displayTime), "EEEE, MMMM d, yyyy 'at' h:mm a")}
              </p>
              {reminder.recurringPattern && (
                <Badge variant="outline" className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {reminder.recurringPattern}
                </Badge>
              )}
              {reminder.status === "snoozed" && (
                <Badge variant="secondary" className="text-xs">
                  Snoozed
                </Badge>
              )}
            </div>
          </div>

          {/* Snooze options (shown for fired reminders) */}
          {isFired && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Snooze
              </h4>
              <SnoozeOptions reminderId={reminder.id} onSnoozed={onClose} />
            </div>
          )}
        </div>

        {/* Actions footer */}
        <div className="border-t p-4 space-y-2">
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={handleComplete}
              disabled={isCompleting}
            >
              <Check className="mr-2 h-4 w-4" />
              Complete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoToMessage}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Go to message
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground hover:text-destructive"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete reminder
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

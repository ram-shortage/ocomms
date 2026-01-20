"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateScheduledMessage } from "@/lib/actions/scheduled-message";

interface ScheduledMessageEditDialogProps {
  message: {
    id: string;
    content: string;
    scheduledFor: Date;
  };
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

/**
 * Dialog for editing a scheduled message's content and/or scheduled time.
 */
export function ScheduledMessageEditDialog({
  message,
  open,
  onClose,
  onSave,
}: ScheduledMessageEditDialogProps) {
  const [content, setContent] = useState(message.content);
  const [scheduledFor, setScheduledFor] = useState(
    format(message.scheduledFor, "yyyy-MM-dd'T'HH:mm")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Minimum datetime is now
  const minDateTime = new Date().toISOString().slice(0, 16);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const updates: { content?: string; scheduledFor?: Date } = {};

      // Only include changed fields
      if (content.trim() !== message.content) {
        updates.content = content.trim();
      }

      const newScheduledFor = new Date(scheduledFor);
      if (newScheduledFor.getTime() !== message.scheduledFor.getTime()) {
        updates.scheduledFor = newScheduledFor;
      }

      // Only update if something changed
      if (Object.keys(updates).length > 0) {
        await updateScheduledMessage(message.id, updates);
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update message");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    content.trim() !== message.content ||
    new Date(scheduledFor).getTime() !== message.scheduledFor.getTime();

  const isValid = content.trim().length > 0 && new Date(scheduledFor) > new Date();

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Scheduled Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Content editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[100px] resize-none"
              disabled={saving}
            />
          </div>

          {/* Scheduled time picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled for
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={minDateTime}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              disabled={saving}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || !isValid || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

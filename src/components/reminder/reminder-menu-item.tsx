"use client";

import { useState } from "react";
import { Bell, Clock, CalendarDays, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { createReminder } from "@/lib/actions/reminder";
import { addDays, setHours, setMinutes, nextMonday, format } from "date-fns";

interface ReminderMenuItemProps {
  messageId: string;
  hasReminder?: boolean;
}

type RecurringPattern = "daily" | "weekly" | undefined;

export function ReminderMenuItem({ messageId, hasReminder = false }: ReminderMenuItemProps) {
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSetReminder = async (remindAt: Date) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await createReminder({
        messageId,
        remindAt,
        note: note.trim() || undefined,
        recurringPattern,
      });

      const formattedTime = format(remindAt, "MMM d 'at' h:mm a");
      const recurringText = recurringPattern
        ? ` (${recurringPattern})`
        : "";
      toast.success(`Reminder set for ${formattedTime}${recurringText}`);

      setOpen(false);
      setNote("");
      setCustomDate("");
      setRecurringPattern(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set reminder");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tomorrow at 9:00 AM
  const getTomorrowNineAm = () => {
    const tomorrow = addDays(new Date(), 1);
    return setMinutes(setHours(tomorrow, 9), 0);
  };

  // Next Monday at 9:00 AM (or today if it's Monday before 9am)
  const getMondayNineAm = () => {
    const monday = nextMonday(new Date());
    return setMinutes(setHours(monday, 9), 0);
  };

  const handleCustomSubmit = () => {
    if (!customDate) {
      toast.error("Please select a date and time");
      return;
    }
    const remindAt = new Date(customDate);
    if (remindAt.getTime() <= Date.now()) {
      toast.error("Reminder time must be in the future");
      return;
    }
    handleSetReminder(remindAt);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`transition-opacity h-7 w-7 p-0 ${
            hasReminder
              ? "opacity-100 text-amber-500 hover:text-amber-600"
              : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
          }`}
        >
          <Bell className={`h-4 w-4 ${hasReminder ? "fill-current" : ""}`} />
          <span className="sr-only">{hasReminder ? "Has reminder set" : "Remind me"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Remind me...</h4>

            {/* Quick pick options */}
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => handleSetReminder(getTomorrowNineAm())}
                disabled={isSubmitting}
              >
                <Clock className="mr-2 h-4 w-4" />
                Tomorrow at 9:00 AM
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => handleSetReminder(getMondayNineAm())}
                disabled={isSubmitting}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Monday at 9:00 AM
              </Button>
            </div>
          </div>

          {/* Custom time */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="custom-time" className="text-sm">
              Custom time
            </Label>
            <Input
              id="custom-time"
              type="datetime-local"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customDate) {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              className="text-sm"
            />
          </div>

          {/* Optional note */}
          <div className="space-y-2">
            <Label htmlFor="reminder-note" className="text-sm">
              Note (optional)
            </Label>
            <Input
              id="reminder-note"
              type="text"
              placeholder="Add a note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Recurring options */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="repeat-daily"
                checked={recurringPattern === "daily"}
                onCheckedChange={(checked) =>
                  setRecurringPattern(checked ? "daily" : undefined)
                }
              />
              <Label htmlFor="repeat-daily" className="text-sm font-normal">
                <RefreshCw className="inline-block mr-1 h-3 w-3" />
                Repeat daily
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="repeat-weekly"
                checked={recurringPattern === "weekly"}
                onCheckedChange={(checked) =>
                  setRecurringPattern(checked ? "weekly" : undefined)
                }
              />
              <Label htmlFor="repeat-weekly" className="text-sm font-normal">
                <RefreshCw className="inline-block mr-1 h-3 w-3" />
                Repeat weekly
              </Label>
            </div>
          </div>

          {/* Set custom reminder button */}
          {customDate && (
            <Button
              size="sm"
              className="w-full"
              onClick={handleCustomSubmit}
              disabled={isSubmitting}
            >
              Set reminder
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

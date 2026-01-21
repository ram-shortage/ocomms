"use client";

import { useState } from "react";
import { ChevronDown, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { addDays, setHours, setMinutes, nextMonday, format, isToday, isTomorrow } from "date-fns";

interface ScheduleSendDropdownProps {
  onSendNow: () => void;
  onSchedule: (scheduledFor: Date) => void;
  disabled?: boolean;
}

/**
 * Split button for send + schedule.
 * Main button sends immediately, dropdown arrow reveals scheduling options.
 * Pattern matches Gmail's "Schedule send" dropdown.
 */
export function ScheduleSendDropdown({
  onSendNow,
  onSchedule,
  disabled,
}: ScheduleSendDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");

  // Quick-pick presets: Tomorrow 9am, Monday 9am
  const tomorrow9am = setMinutes(setHours(addDays(new Date(), 1), 9), 0);
  const nextMon9am = setMinutes(setHours(nextMonday(new Date()), 9), 0);

  // Get minimum datetime for custom input (current time)
  const minDateTime = new Date().toISOString().slice(0, 16);

  const handleQuickPick = (date: Date) => {
    onSchedule(date);
    setIsOpen(false);
    setShowCustom(false);
  };

  const handleCustomSchedule = () => {
    if (customDateTime) {
      // datetime-local gives local time string, parse as local Date
      const scheduledDate = new Date(customDateTime);
      onSchedule(scheduledDate);
      setIsOpen(false);
      setShowCustom(false);
      setCustomDateTime("");
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset custom state when closing
      setShowCustom(false);
      setCustomDateTime("");
    }
  };

  // Format preview text for quick picks
  const formatQuickPickLabel = (date: Date) => {
    if (isTomorrow(date)) {
      return `Tomorrow at ${format(date, "h:mm a")}`;
    }
    return `${format(date, "EEEE")} at ${format(date, "h:mm a")}`;
  };

  return (
    <div className="flex">
      <Button
        type="button"
        onClick={onSendNow}
        disabled={disabled}
        className="rounded-r-none h-11 w-9 p-0"
      >
        <Send className="h-5 w-5" />
        <span className="sr-only">Send now</span>
      </Button>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            disabled={disabled}
            className="rounded-l-none border-l border-l-primary-foreground/20 h-11 w-6 p-0"
          >
            <ChevronDown className="h-4 w-4" />
            <span className="sr-only">Schedule send options</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2" sideOffset={8}>
          <div className="space-y-1">
            <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Schedule send
            </p>
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm flex items-center gap-2"
              onClick={() => handleQuickPick(tomorrow9am)}
            >
              <Clock className="h-4 w-4 text-muted-foreground" />
              {formatQuickPickLabel(tomorrow9am)}
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm flex items-center gap-2"
              onClick={() => handleQuickPick(nextMon9am)}
            >
              <Clock className="h-4 w-4 text-muted-foreground" />
              {formatQuickPickLabel(nextMon9am)}
            </button>
            <hr className="my-2 border-border" />
            {showCustom ? (
              <div className="p-2 space-y-2">
                <label className="text-xs text-muted-foreground">
                  Pick a date and time
                </label>
                <input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customDateTime) {
                      e.preventDefault();
                      handleCustomSchedule();
                    }
                  }}
                  min={minDateTime}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={handleCustomSchedule}
                  disabled={!customDateTime}
                >
                  Schedule
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm flex items-center gap-2"
                onClick={() => setShowCustom(true)}
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                Custom time...
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

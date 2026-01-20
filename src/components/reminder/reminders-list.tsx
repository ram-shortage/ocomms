"use client";

import { useState, useEffect } from "react";
import { Bell, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { getReminders } from "@/lib/actions/reminder";

type ReminderStatus = "pending" | "fired" | "snoozed";

interface Reminder {
  id: string;
  note: string | null;
  remindAt: Date;
  status: ReminderStatus;
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
}

interface RemindersListProps {
  onReminderClick?: (reminder: Reminder) => void;
}

export function RemindersList({ onReminderClick }: RemindersListProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReminders = async () => {
    try {
      const data = await getReminders();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setReminders(data as any[]);
    } catch (error) {
      console.error("Failed to fetch reminders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading reminders...
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Bell className="h-8 w-8 mb-2 opacity-50" />
        <p>No reminders</p>
        <p className="text-xs mt-1">Set reminders from any message</p>
      </div>
    );
  }

  // Group by status: "Needs attention" (fired) first, then "Upcoming" (pending, snoozed)
  const firedReminders = reminders.filter((r) => r.status === "fired");
  const upcomingReminders = reminders.filter((r) => r.status === "pending" || r.status === "snoozed");

  return (
    <div className="space-y-4">
      {/* Fired reminders - needs attention */}
      {firedReminders.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Needs attention
          </h3>
          <div className="space-y-1">
            {firedReminders.map((reminder) => (
              <ReminderItem
                key={reminder.id}
                reminder={reminder}
                onClick={() => onReminderClick?.(reminder)}
                highlight
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming reminders */}
      {upcomingReminders.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Upcoming
          </h3>
          <div className="space-y-1">
            {upcomingReminders.map((reminder) => (
              <ReminderItem
                key={reminder.id}
                reminder={reminder}
                onClick={() => onReminderClick?.(reminder)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ReminderItemProps {
  reminder: Reminder;
  onClick?: () => void;
  highlight?: boolean;
}

function ReminderItem({ reminder, onClick, highlight }: ReminderItemProps) {
  const messagePreview = reminder.message.content.slice(0, 60) + (reminder.message.content.length > 60 ? "..." : "");
  const authorName = reminder.message.author?.name || reminder.message.author?.email || "Unknown";

  // Determine display time
  const displayTime = reminder.status === "snoozed" && reminder.snoozedUntil
    ? reminder.snoozedUntil
    : reminder.remindAt;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors ${
        highlight ? "bg-amber-500/10 border border-amber-500/20" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${highlight ? "text-amber-500" : "text-muted-foreground"}`} />
        <div className="flex-1 min-w-0">
          {/* Message preview */}
          <p className="text-sm truncate">{messagePreview}</p>

          {/* Note if set */}
          {reminder.note && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Note: {reminder.note}
            </p>
          )}

          {/* Time and badges */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {reminder.status === "fired"
                ? `Fired ${formatDistanceToNow(new Date(displayTime), { addSuffix: true })}`
                : format(new Date(displayTime), "MMM d 'at' h:mm a")}
            </span>

            {/* Recurring badge */}
            {reminder.recurringPattern && (
              <Badge variant="outline" className="text-[10px] h-4">
                <RefreshCw className="h-2 w-2 mr-1" />
                {reminder.recurringPattern}
              </Badge>
            )}

            {/* Snoozed badge */}
            {reminder.status === "snoozed" && (
              <Badge variant="secondary" className="text-[10px] h-4">
                Snoozed
              </Badge>
            )}
          </div>

          {/* Author */}
          <p className="text-xs text-muted-foreground mt-1">
            from {authorName}
          </p>
        </div>
        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
}

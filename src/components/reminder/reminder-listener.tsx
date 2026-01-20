"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/lib/socket-client";
import { toast } from "sonner";
import type { Reminder, Message } from "@/lib/socket-events";
import { ReminderDetailPanel } from "./reminder-detail-panel";

interface ReminderListenerProps {
  workspaceSlug?: string;
}

/**
 * Component that listens for reminder:fired events and shows toast notifications.
 * Should be mounted once in the workspace layout.
 */
export function ReminderListener({ workspaceSlug }: ReminderListenerProps) {
  const socket = useSocket();
  const [selectedReminder, setSelectedReminder] = useState<{
    reminder: Reminder;
    message: Message;
  } | null>(null);

  useEffect(() => {
    const handleReminderFired = (data: { reminder: Reminder; message: Message }) => {
      console.log("[ReminderListener] Received reminder:fired", data);

      const messagePreview = data.message.content.slice(0, 50);
      const displayText = data.reminder.note || messagePreview;

      toast.info("Reminder", {
        description: displayText + (displayText.length < data.message.content.length && !data.reminder.note ? "..." : ""),
        duration: 10000, // Show for 10 seconds
        action: {
          label: "View",
          onClick: () => {
            setSelectedReminder(data);
          },
        },
      });
    };

    socket.on("reminder:fired", handleReminderFired);

    return () => {
      socket.off("reminder:fired", handleReminderFired);
    };
  }, [socket]);

  const handleCloseDetail = () => {
    setSelectedReminder(null);
  };

  // Transform the socket data to match the detail panel's expected format
  const reminderForPanel = selectedReminder ? {
    id: selectedReminder.reminder.id,
    note: selectedReminder.reminder.note,
    remindAt: selectedReminder.reminder.remindAt,
    status: selectedReminder.reminder.status,
    recurringPattern: selectedReminder.reminder.recurringPattern,
    snoozedUntil: null,
    message: {
      id: selectedReminder.message.id,
      content: selectedReminder.message.content,
      channelId: selectedReminder.message.channelId ?? null,
      conversationId: selectedReminder.message.conversationId ?? null,
      author: selectedReminder.message.author ? {
        id: selectedReminder.message.author.id,
        name: selectedReminder.message.author.name,
        email: selectedReminder.message.author.email,
      } : null,
    },
  } : null;

  return (
    <ReminderDetailPanel
      isOpen={!!selectedReminder}
      onClose={handleCloseDetail}
      reminder={reminderForPanel}
      workspaceSlug={workspaceSlug}
    />
  );
}

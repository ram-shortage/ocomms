"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Bell } from "lucide-react";
import { RemindersList, type Reminder } from "@/components/reminder/reminders-list";
import { ReminderDetailPanel } from "@/components/reminder/reminder-detail-panel";

export default function RemindersPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);

  const handleReminderClick = (reminder: Reminder) => {
    setSelectedReminder(reminder);
  };

  const handleCloseDetail = () => {
    setSelectedReminder(null);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Reminders</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          View and manage your message reminders
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <RemindersList onReminderClick={handleReminderClick} showCompleted />
      </div>

      {/* Detail panel */}
      <ReminderDetailPanel
        isOpen={!!selectedReminder}
        onClose={handleCloseDetail}
        reminder={selectedReminder}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}

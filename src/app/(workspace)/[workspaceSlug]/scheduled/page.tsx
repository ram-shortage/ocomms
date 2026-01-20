"use client";

import { Clock } from "lucide-react";
import { ScheduledMessagesList } from "@/components/schedule/scheduled-messages-list";

export default function ScheduledPage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <h1 className="text-xl font-semibold">Scheduled Messages</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          View and manage your scheduled messages
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <ScheduledMessagesList />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Clock, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { snoozeReminder } from "@/lib/actions/reminder";

interface SnoozeOptionsProps {
  reminderId: string;
  onSnoozed?: () => void;
}

type SnoozeDuration = "20min" | "1hour" | "3hours" | "tomorrow";

const SNOOZE_OPTIONS: Array<{ value: SnoozeDuration; label: string; icon?: "clock" | "sun" }> = [
  { value: "20min", label: "20 minutes", icon: "clock" },
  { value: "1hour", label: "1 hour", icon: "clock" },
  { value: "3hours", label: "3 hours", icon: "clock" },
  { value: "tomorrow", label: "Tomorrow 9am", icon: "sun" },
];

export function SnoozeOptions({ reminderId, onSnoozed }: SnoozeOptionsProps) {
  const [isSnoozing, setIsSnoozing] = useState(false);

  const handleSnooze = async (duration: SnoozeDuration) => {
    if (isSnoozing) return;
    setIsSnoozing(true);

    try {
      await snoozeReminder(reminderId, duration);

      const option = SNOOZE_OPTIONS.find((o) => o.value === duration);
      toast.success(`Reminder snoozed for ${option?.label}`);

      onSnoozed?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to snooze reminder");
    } finally {
      setIsSnoozing(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {SNOOZE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant="outline"
          size="sm"
          onClick={() => handleSnooze(option.value)}
          disabled={isSnoozing}
          className="text-xs"
        >
          {option.icon === "sun" ? (
            <Sun className="mr-1 h-3 w-3" />
          ) : (
            <Clock className="mr-1 h-3 w-3" />
          )}
          {option.label}
        </Button>
      ))}
    </div>
  );
}

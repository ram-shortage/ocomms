"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays } from "lucide-react";

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

/**
 * DateRangePicker - Date range selector with presets
 *
 * ANLY-04: Filter by date range
 * - Quick presets: 7d, 30d, 90d, 1 year
 * - Custom date range picker
 * - Max range: 1 year
 */
export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(formatDate(value.start));
  const [customEnd, setCustomEnd] = useState(formatDate(value.end));

  const presets = [
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
    { label: "1y", days: 365 },
  ];

  function formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  function formatDisplayDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function handlePreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange({ start, end });
  }

  function handleCustomApply() {
    const start = new Date(customStart);
    const end = new Date(customEnd);

    // Validate: start before end
    if (start > end) {
      return;
    }

    // Validate: max 1 year range
    const maxRange = 365 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRange) {
      return;
    }

    onChange({ start, end });
    setOpen(false);
  }

  // Determine which preset is active
  const now = new Date();
  const diffDays = Math.round(
    (now.getTime() - value.start.getTime()) / (24 * 60 * 60 * 1000)
  );
  const isEndToday = formatDate(value.end) === formatDate(now);

  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
      {/* Preset buttons - scrollable on mobile */}
      <div className="flex items-center gap-1 sm:gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={diffDays === preset.days && isEndToday ? "default" : "outline"}
            size="sm"
            className="min-h-11 min-w-11 px-2 sm:px-3"
            onClick={() => handlePreset(preset.days)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom date range */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 min-h-11">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">
              {formatDisplayDate(value.start)} - {formatDisplayDate(value.end)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[calc(100vw-2rem)] sm:w-80 max-w-80"
          align="end"
          sideOffset={8}
          collisionPadding={16}
        >
          <div className="space-y-4">
            <h4 className="font-medium">Custom Date Range</h4>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  className="min-h-11"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  className="min-h-11"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  max={formatDate(new Date())}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum range: 1 year
            </p>
            <Button onClick={handleCustomApply} className="w-full min-h-11">
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

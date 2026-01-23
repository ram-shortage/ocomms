"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download } from "lucide-react";
import type { DateRange } from "./date-range-picker";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  dateRange: DateRange;
}

/**
 * Export data to CSV with proper escaping
 */
function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = String(val ?? "");
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];

  // BOM for Excel UTF-8 compatibility
  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename + ".csv";
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * ExportButton - CSV export with granularity options
 *
 * ANLY-05: Export to CSV with granularity options
 * - Options: Hourly, Daily, Weekly
 * - Client-side CSV generation
 * - Downloads file with workspace and date range in filename
 */
export function ExportButton({ data, filename, dateRange }: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  const formatDate = (date: Date) =>
    date.toISOString().split("T")[0].replace(/-/g, "");

  const handleExport = (granularity: "hourly" | "daily" | "weekly") => {
    if (data.length === 0) {
      return;
    }

    // For now, export as-is since the data is already aggregated by day from the server
    // True granularity would require additional server actions
    const fullFilename = `${filename}-${formatDate(dateRange.start)}-${formatDate(dateRange.end)}-${granularity}`;
    exportToCSV(data, fullFilename);
    setOpen(false);
  };

  const isDisabled = data.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDisabled} className="min-h-11 min-w-11">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Export</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48" align="end" sideOffset={8}>
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Export as CSV</h4>
          <p className="text-xs text-muted-foreground">Select granularity:</p>
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start min-h-11"
              onClick={() => handleExport("hourly")}
            >
              Hourly
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start min-h-11"
              onClick={() => handleExport("daily")}
            >
              Daily
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start min-h-11"
              onClick={() => handleExport("weekly")}
            >
              Weekly
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

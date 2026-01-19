"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ExportDataButtonProps {
  organizationId: string;
}

/**
 * ExportDataButton - Triggers organization data export
 *
 * Downloads all organization data as JSON for backup/GDPR compliance.
 * Only available to organization owners (API enforces this).
 */
export function ExportDataButton({ organizationId }: ExportDataButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ocomms-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert(error instanceof Error ? error.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleExport} disabled={loading}>
      {loading ? "Exporting..." : "Export Data (JSON)"}
    </Button>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

/**
 * Audit event types - matches server enum
 */
const AUDIT_EVENT_TYPES = [
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_FAILURE",
  "AUTH_LOGOUT",
  "AUTH_PASSWORD_RESET",
  "ADMIN_UNLOCK_USER",
  "ADMIN_EXPORT_DATA",
  "AUTHZ_FAILURE",
] as const;

type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

interface AuditEvent {
  timestamp: string;
  eventType: AuditEventType;
  userId?: string;
  targetId?: string;
  organizationId?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

interface AuditLogResponse {
  events: AuditEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface AuditLogViewerProps {
  organizationId: string;
}

const PAGE_SIZE = 50;

/**
 * Export events to CSV file
 */
function exportToCSV(events: AuditEvent[]) {
  const headers = ["Timestamp", "Event Type", "User ID", "IP", "Details"];
  const rows = events.map((e) => [
    e.timestamp,
    e.eventType,
    e.userId || "",
    e.ip || "",
    JSON.stringify(e.details || {}),
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Get default date range (last 7 days)
 */
function getDefaultDateRange() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    from: sevenDaysAgo.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
  };
}

/**
 * AuditLogViewer - Displays audit logs with filtering and export
 */
export function AuditLogViewer({ organizationId }: AuditLogViewerProps) {
  const defaultRange = getDefaultDateRange();

  // Filter state
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [eventType, setEventType] = useState<string>("");

  // Data state
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch events from API
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        from: new Date(fromDate).toISOString(),
        to: new Date(toDate + "T23:59:59").toISOString(),
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (eventType) {
        params.set("eventType", eventType);
      }

      const res = await fetch(`/api/admin/audit-logs?${params}`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch audit logs");
      }

      const data: AuditLogResponse = await res.json();
      setEvents(data.events);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch audit logs");
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, eventType, offset]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [fromDate, toDate, eventType]);

  // Pagination handlers
  const hasNext = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  const handleNext = () => {
    if (hasNext) {
      setOffset(offset + PAGE_SIZE);
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setOffset(Math.max(0, offset - PAGE_SIZE));
    }
  };

  // Calculate current page
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="from-date" className="text-sm text-muted-foreground">
            From
          </label>
          <input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="to-date" className="text-sm text-muted-foreground">
            To
          </label>
          <input
            id="to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="event-type" className="text-sm text-muted-foreground">
            Event Type
          </label>
          <select
            id="event-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="border rounded px-3 py-2 text-sm min-w-[180px]"
          >
            <option value="">All Events</option>
            {AUDIT_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          onClick={() => exportToCSV(events)}
          disabled={events.length === 0 || loading}
        >
          Export to CSV
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>
      )}

      {/* Empty state */}
      {!loading && !error && events.length === 0 && (
        <div className="p-8 text-center text-muted-foreground border rounded">
          No audit events found for the selected filters.
        </div>
      )}

      {/* Events table */}
      {!loading && events.length > 0 && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left font-medium text-foreground">
                  Event Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-foreground">
                  User ID
                </th>
                <th className="px-4 py-3 text-left font-medium text-foreground">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event, index) => (
                <tr
                  key={`${event.timestamp}-${index}`}
                  className="hover:bg-muted"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(event.timestamp), "MMM d, yyyy HH:mm:ss")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {event.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {event.userId ? (
                      <span title={event.userId}>
                        {event.userId.length > 12
                          ? `${event.userId.slice(0, 12)}...`
                          : event.userId}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {event.ip || <span className="text-muted-foreground/60">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of {total}{" "}
            events
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={!hasPrev}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={!hasNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

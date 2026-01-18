import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { members } from "@/db/schema";
import { AuditEvent, AuditEventType } from "@/lib/audit-logger";

interface AuditLogResponse {
  events: AuditEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Get log files for a date range
 * Files are named YYYY-MM-DD.jsonl
 */
function getLogFilesInRange(from: Date, to: Date): string[] {
  const logsDir = path.join(process.cwd(), "logs");

  if (!fs.existsSync(logsDir)) {
    return [];
  }

  const files = fs.readdirSync(logsDir);
  const logFiles: string[] = [];

  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;

    // Parse date from filename (YYYY-MM-DD.jsonl)
    const dateStr = file.replace(".jsonl", "");
    const fileDate = new Date(dateStr + "T00:00:00Z");

    // Check if file date is within range
    // Include file if its date falls within from/to range
    const fromDateOnly = new Date(from.toISOString().split("T")[0] + "T00:00:00Z");
    const toDateOnly = new Date(to.toISOString().split("T")[0] + "T23:59:59Z");

    if (fileDate >= fromDateOnly && fileDate <= toDateOnly) {
      logFiles.push(path.join(logsDir, file));
    }
  }

  // Sort files by date (oldest first for chronological reading)
  return logFiles.sort();
}

/**
 * Parse a log file and return events
 */
function parseLogFile(filePath: string): AuditEvent[] {
  const events: AuditEvent[] = [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as AuditEvent;
        events.push(event);
      } catch {
        // Skip malformed lines
        console.error(`Malformed audit log line in ${filePath}`);
      }
    }
  } catch (error) {
    console.error(`Failed to read audit log file ${filePath}:`, error);
  }

  return events;
}

// GET /api/admin/audit-logs - Query audit logs
export async function GET(request: Request) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization memberships where they are admin or owner
    const userMemberships = await db.query.members.findMany({
      where: eq(members.userId, session.user.id),
    });

    const adminMemberships = userMemberships.filter(
      (m) => m.role === "admin" || m.role === "owner"
    );

    if (adminMemberships.length === 0) {
      return NextResponse.json(
        { error: "Only organization admins can access audit logs" },
        { status: 403 }
      );
    }

    const adminOrgIds = adminMemberships.map((m) => m.organizationId);

    // Parse query parameters
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const eventTypeParam = url.searchParams.get("eventType");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    // Default: last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let from: Date;
    let to: Date;

    try {
      from = fromParam ? new Date(fromParam) : sevenDaysAgo;
      to = toParam ? new Date(toParam) : now;

      // Validate dates
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format. Use ISO 8601 format." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601 format." },
        { status: 400 }
      );
    }

    // Parse limit and offset
    const limit = Math.min(Math.max(parseInt(limitParam || "100", 10), 1), 1000);
    const offset = Math.max(parseInt(offsetParam || "0", 10), 0);

    // Validate event type if provided
    if (
      eventTypeParam &&
      !Object.values(AuditEventType).includes(eventTypeParam as AuditEventType)
    ) {
      return NextResponse.json(
        {
          error: `Invalid eventType. Valid values: ${Object.values(AuditEventType).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Get relevant log files
    const logFiles = getLogFilesInRange(from, to);

    // Read and parse all events
    const allEvents: AuditEvent[] = [];
    for (const file of logFiles) {
      const events = parseLogFile(file);
      allEvents.push(...events);
    }

    // Filter events
    const filteredEvents = allEvents.filter((event) => {
      // Time range filter
      const eventTime = new Date(event.timestamp);
      if (eventTime < from || eventTime > to) {
        return false;
      }

      // Event type filter
      if (eventTypeParam && event.eventType !== eventTypeParam) {
        return false;
      }

      // Organization/user scoping:
      // - If event has organizationId, must be in admin's orgs
      // - If event has no organizationId (like auth failures), show if:
      //   - userId matches current user, OR
      //   - targetId is in one of admin's orgs (need to check membership)
      if (event.organizationId) {
        if (!adminOrgIds.includes(event.organizationId)) {
          return false;
        }
      } else {
        // Events without organizationId (personal/auth events)
        // Show if it's the current user's own event
        if (event.userId === session.user.id) {
          return true;
        }

        // For events with targetId, we'd need to check if target is in admin's org
        // For simplicity, only show events where userId matches current user
        // or organizationId is set and in admin's orgs (already handled above)
        return false;
      }

      return true;
    });

    // Sort by timestamp descending (newest first)
    filteredEvents.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination
    const total = filteredEvents.length;
    const paginatedEvents = filteredEvents.slice(offset, offset + limit);

    const response: AuditLogResponse = {
      events: paginatedEvents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Audit log query error:", error);
    return NextResponse.json(
      { error: "Failed to query audit logs" },
      { status: 500 }
    );
  }
}

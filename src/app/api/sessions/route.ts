import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserSessions } from "@/lib/security/session-store";
import { db } from "@/db";
import { session } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { errorResponse } from "@/app/api/error-handling";

/**
 * Parse user agent string to extract device and browser info.
 * Simple parsing without external library.
 */
function parseUserAgent(ua: string | null) {
  if (!ua) return { device: "Unknown", browser: "Unknown" };

  const browser = ua.includes("Chrome")
    ? "Chrome"
    : ua.includes("Firefox")
    ? "Firefox"
    : ua.includes("Safari")
    ? "Safari"
    : ua.includes("Edge")
    ? "Edge"
    : "Unknown";

  const device = ua.includes("Mobile")
    ? "Mobile"
    : ua.includes("Tablet")
    ? "Tablet"
    : "Desktop";

  return { device, browser };
}

/**
 * GET /api/sessions - List all active sessions for the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const sessionData = await auth.api.getSession({
      headers: await headers(),
    });

    if (!sessionData?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionData.user.id;
    const currentSessionId = sessionData.session?.id;

    // Get all active session IDs from Redis
    const sessionIds = await getUserSessions(userId);

    if (sessionIds.length === 0) {
      return NextResponse.json([]);
    }

    // Query database for session metadata
    const sessions = await Promise.all(
      sessionIds.map(async (sessionId) => {
        const sessionRecord = await db.query.session.findFirst({
          where: eq(session.id, sessionId),
          columns: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!sessionRecord) {
          return null;
        }

        const { device, browser } = parseUserAgent(sessionRecord.userAgent);

        return {
          id: sessionRecord.id,
          ipAddress: sessionRecord.ipAddress || "Unknown",
          device,
          browser,
          lastActive: sessionRecord.updatedAt,
          isCurrent: sessionRecord.id === currentSessionId,
        };
      })
    );

    // Filter out null results (sessions that don't exist in DB)
    const validSessions = sessions.filter((s) => s !== null);

    return NextResponse.json(validSessions);
  } catch (error) {
    return errorResponse(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserSessions,
  removeUserSession,
  revokeAllUserSessions,
} from "@/lib/security/session-store";
import { headers } from "next/headers";

/**
 * POST /api/sessions/revoke - Revoke one or all sessions
 * Body: { sessionId?: string, all?: boolean }
 */
export async function POST(request: NextRequest) {
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

    if (!currentSessionId) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { sessionId, all } = body;

    // Revoke all sessions except current
    if (all === true) {
      await revokeAllUserSessions(userId, currentSessionId);
      return NextResponse.json({
        success: true,
        message: "All other sessions revoked successfully",
      });
    }

    // Revoke specific session
    if (sessionId) {
      // Prevent revoking current session
      if (sessionId === currentSessionId) {
        return NextResponse.json(
          {
            error: "Cannot revoke current session. Please log out instead.",
          },
          { status: 400 }
        );
      }

      // Verify session belongs to user
      const userSessions = await getUserSessions(userId);
      if (!userSessions.includes(sessionId)) {
        return NextResponse.json(
          { error: "Session not found or does not belong to user" },
          { status: 404 }
        );
      }

      // Revoke the session
      await removeUserSession(userId, sessionId);
      return NextResponse.json({
        success: true,
        message: "Session revoked successfully",
      });
    }

    return NextResponse.json(
      { error: "Must specify either sessionId or all: true" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Sessions Revoke API] Error revoking session:", error);
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 }
    );
  }
}

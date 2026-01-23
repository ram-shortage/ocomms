import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { storeLastVisited, getLastVisited } from "@/server/redis";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/workspace/last-visited
 * Store the last-visited path for current workspace.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { workspaceId, path } = body;

    if (!workspaceId || !path) {
      return NextResponse.json(
        { error: "workspaceId and path are required" },
        { status: 400 }
      );
    }

    // Verify user is a member of the workspace
    const member = await db.query.members.findFirst({
      where: and(
        eq(members.userId, session.user.id),
        eq(members.organizationId, workspaceId)
      ),
    });

    if (!member) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Store the last-visited path
    await storeLastVisited(session.user.id, workspaceId, path);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error storing last-visited path:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workspace/last-visited?workspaceId=...
 * Get the last-visited path for a workspace.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    // Verify user is a member of the workspace
    const member = await db.query.members.findFirst({
      where: and(
        eq(members.userId, session.user.id),
        eq(members.organizationId, workspaceId)
      ),
    });

    if (!member) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get the last-visited path
    const path = await getLastVisited(session.user.id, workspaceId);

    return NextResponse.json({ path });
  } catch (error) {
    console.error("Error getting last-visited path:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

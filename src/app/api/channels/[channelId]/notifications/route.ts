import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { channelNotificationSettings, channelMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { NotificationMode } from "@/db/schema/channel-notification-settings";

// GET /api/channels/[channelId]/notifications - Get notification settings for current user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;

    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is member of channel
    const membership = await db.query.channelMembers.findFirst({
      where: and(
        eq(channelMembers.channelId, channelId),
        eq(channelMembers.userId, session.user.id)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a channel member" }, { status: 403 });
    }

    // Query settings - no entry means "all" mode (default)
    const settings = await db.query.channelNotificationSettings.findFirst({
      where: and(
        eq(channelNotificationSettings.channelId, channelId),
        eq(channelNotificationSettings.userId, session.user.id)
      ),
    });

    return NextResponse.json({
      mode: (settings?.mode as NotificationMode) ?? "all",
    });
  } catch (error) {
    console.error("Get notification settings error:", error);
    return NextResponse.json(
      { error: "Failed to get notification settings" },
      { status: 500 }
    );
  }
}

// PUT /api/channels/[channelId]/notifications - Update notification settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const body = await request.json();
    const { mode } = body as { mode: NotificationMode };

    // Validate mode
    if (!["all", "mentions", "muted"].includes(mode)) {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'all', 'mentions', or 'muted'" },
        { status: 400 }
      );
    }

    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is member of channel
    const membership = await db.query.channelMembers.findFirst({
      where: and(
        eq(channelMembers.channelId, channelId),
        eq(channelMembers.userId, session.user.id)
      ),
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a channel member" }, { status: 403 });
    }

    if (mode === "all") {
      // Delete the row to return to default behavior
      await db
        .delete(channelNotificationSettings)
        .where(
          and(
            eq(channelNotificationSettings.channelId, channelId),
            eq(channelNotificationSettings.userId, session.user.id)
          )
        );
    } else {
      // Upsert settings (onConflictDoUpdate on channelId+userId)
      await db
        .insert(channelNotificationSettings)
        .values({
          channelId,
          userId: session.user.id,
          mode,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [channelNotificationSettings.channelId, channelNotificationSettings.userId],
          set: {
            mode,
            updatedAt: new Date(),
          },
        });
    }

    return NextResponse.json({ mode });
  } catch (error) {
    console.error("Update notification settings error:", error);
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 }
    );
  }
}

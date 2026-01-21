import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { pinnedMessages, channelMembers, messages, users } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

// GET /api/channels/[channelId]/pins - Get all pinned messages for a channel
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

    // Query pinned messages with message content and author info
    const pins = await db
      .select({
        id: pinnedMessages.id,
        messageId: pinnedMessages.messageId,
        channelId: pinnedMessages.channelId,
        pinnedAt: pinnedMessages.pinnedAt,
        pinnedById: pinnedMessages.pinnedBy,
        pinnedByName: users.name,
        messageContent: messages.content,
        messageCreatedAt: messages.createdAt,
        messageDeletedAt: messages.deletedAt,
        authorId: messages.authorId,
      })
      .from(pinnedMessages)
      .innerJoin(messages, eq(pinnedMessages.messageId, messages.id))
      .leftJoin(users, eq(pinnedMessages.pinnedBy, users.id))
      .where(
        and(
          eq(pinnedMessages.channelId, channelId),
          isNull(messages.deletedAt)
        )
      )
      .orderBy(pinnedMessages.pinnedAt);

    // L-6 FIX: Batch fetch all authors at once using inArray
    const authorIds = [...new Set(pins.map((p) => p.authorId).filter(Boolean))];
    const authorsMap: Record<string, { id: string; name: string; email: string }> = {};

    if (authorIds.length > 0) {
      const authors = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, authorIds));

      for (const author of authors) {
        authorsMap[author.id] = author;
      }
    }

    // Transform to response format
    const formattedPins = pins.map((pin) => ({
      id: pin.id,
      messageId: pin.messageId,
      pinnedAt: pin.pinnedAt,
      message: {
        id: pin.messageId,
        content: pin.messageContent,
        createdAt: pin.messageCreatedAt,
        author: authorsMap[pin.authorId] || { id: pin.authorId, name: "Unknown", email: "" },
      },
      pinnedBy: {
        id: pin.pinnedById,
        name: pin.pinnedByName || "Unknown",
      },
    }));

    return NextResponse.json({ pins: formattedPins });
  } catch (error) {
    console.error("Get pinned messages error:", error);
    return NextResponse.json(
      { error: "Failed to get pinned messages" },
      { status: 500 }
    );
  }
}

// POST /api/channels/[channelId]/pins - Pin a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 });
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

    // Verify message belongs to this channel and is not deleted
    const message = await db.query.messages.findFirst({
      where: and(
        eq(messages.id, messageId),
        eq(messages.channelId, channelId),
        isNull(messages.deletedAt)
      ),
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found in this channel" }, { status: 404 });
    }

    // Insert pinned message (onConflictDoNothing prevents duplicates)
    await db
      .insert(pinnedMessages)
      .values({
        messageId,
        channelId,
        pinnedBy: session.user.id,
      })
      .onConflictDoNothing();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pin message error:", error);
    return NextResponse.json(
      { error: "Failed to pin message" },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/[channelId]/pins?messageId=X - Unpin a message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json({ error: "messageId query param is required" }, { status: 400 });
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

    // Delete the pin
    await db
      .delete(pinnedMessages)
      .where(
        and(
          eq(pinnedMessages.messageId, messageId),
          eq(pinnedMessages.channelId, channelId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unpin message error:", error);
    return NextResponse.json(
      { error: "Failed to unpin message" },
      { status: 500 }
    );
  }
}

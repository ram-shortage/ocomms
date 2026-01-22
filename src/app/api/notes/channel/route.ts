import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { channelNotes, channelMembers, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { sanitizeHtml } from "@/lib/sanitize";
import { auditLog, AuditEventType, getClientIP, getUserAgent } from "@/lib/audit-logger";

/**
 * GET /api/notes/channel?channelId=X - Get channel note content
 * Returns note content and version for optimistic locking.
 * Returns empty note (version 0) if no note exists yet.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    // SEC2-06: Verify user is member of channel BEFORE fetching data (fail closed)
    const membership = await db.query.channelMembers.findFirst({
      where: and(
        eq(channelMembers.channelId, channelId),
        eq(channelMembers.userId, session.user.id)
      ),
    });

    if (!membership) {
      // Log unauthorized access attempt as security event
      const requestHeaders = await headers();
      auditLog({
        eventType: AuditEventType.AUTHZ_FAILURE,
        userId: session.user.id,
        ip: getClientIP(requestHeaders),
        userAgent: getUserAgent(requestHeaders),
        details: {
          action: "channel_notes_read",
          channelId,
          reason: "not_channel_member",
        },
      });
      // Same error for "not found" and "not authorized" to prevent info leakage
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    // Query channel note with updatedBy user info
    const note = await db
      .select({
        content: channelNotes.content,
        version: channelNotes.version,
        updatedBy: channelNotes.updatedBy,
        updatedByName: users.name,
        updatedAt: channelNotes.updatedAt,
      })
      .from(channelNotes)
      .leftJoin(users, eq(channelNotes.updatedBy, users.id))
      .where(eq(channelNotes.channelId, channelId))
      .limit(1);

    // If no note exists, return empty note (will be created on first save)
    if (note.length === 0) {
      return NextResponse.json({
        content: "",
        version: 0,
        updatedBy: null,
        updatedByName: null,
        updatedAt: null,
      });
    }

    return NextResponse.json({
      content: note[0].content,
      version: note[0].version,
      updatedBy: note[0].updatedBy,
      updatedByName: note[0].updatedByName,
      updatedAt: note[0].updatedAt,
    });
  } catch (error) {
    console.error("Get channel note error:", error);
    return NextResponse.json(
      { error: "Failed to get channel note" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notes/channel - Save channel note with optimistic locking
 * Body: { channelId, content, baseVersion }
 * Returns 409 with conflict data if version mismatch detected.
 */
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { channelId, content, baseVersion } = body;

    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 }
      );
    }

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "content must be a string" },
        { status: 400 }
      );
    }

    if (typeof baseVersion !== "number") {
      return NextResponse.json(
        { error: "baseVersion must be a number" },
        { status: 400 }
      );
    }

    // SEC2-06: Verify user is member of channel BEFORE modifying data (fail closed)
    const membership = await db.query.channelMembers.findFirst({
      where: and(
        eq(channelMembers.channelId, channelId),
        eq(channelMembers.userId, session.user.id)
      ),
    });

    if (!membership) {
      // Log unauthorized access attempt as security event
      const requestHeaders = await headers();
      auditLog({
        eventType: AuditEventType.AUTHZ_FAILURE,
        userId: session.user.id,
        ip: getClientIP(requestHeaders),
        userAgent: getUserAgent(requestHeaders),
        details: {
          action: "channel_notes_write",
          channelId,
          reason: "not_channel_member",
        },
      });
      // Same error for "not found" and "not authorized" to prevent info leakage
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    // SEC2-05: Sanitize HTML content before storage
    // Allows safe tags (b, i, strong, em, a, p, ul, ol, li, br) while stripping scripts/styles
    const sanitizedContent = sanitizeHtml(content);

    // If baseVersion is 0, this is a new note - INSERT
    if (baseVersion === 0) {
      const [inserted] = await db
        .insert(channelNotes)
        .values({
          channelId,
          content: sanitizedContent,
          version: 1,
          updatedBy: session.user.id,
        })
        .onConflictDoNothing()
        .returning({ version: channelNotes.version });

      // If insert returned nothing, note was created by another user concurrently
      if (!inserted) {
        // Fetch the current note to return conflict info
        const currentNote = await db
          .select({
            content: channelNotes.content,
            version: channelNotes.version,
            updatedBy: channelNotes.updatedBy,
            updatedByName: users.name,
          })
          .from(channelNotes)
          .leftJoin(users, eq(channelNotes.updatedBy, users.id))
          .where(eq(channelNotes.channelId, channelId))
          .limit(1);

        return NextResponse.json(
          {
            success: false,
            conflict: {
              serverContent: currentNote[0]?.content || "",
              serverVersion: currentNote[0]?.version || 1,
              editedBy: currentNote[0]?.updatedBy,
              editedByName: currentNote[0]?.updatedByName || "Another user",
            },
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        newVersion: inserted.version,
      });
    }

    // Otherwise, UPDATE with version check for optimistic locking
    const result = await db
      .update(channelNotes)
      .set({
        content: sanitizedContent,
        version: sql`${channelNotes.version} + 1`,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channelNotes.channelId, channelId),
          eq(channelNotes.version, baseVersion) // Only update if version matches
        )
      )
      .returning({ version: channelNotes.version });

    // If no rows updated, version mismatch (conflict)
    if (result.length === 0) {
      // Fetch current note to return conflict info
      const currentNote = await db
        .select({
          content: channelNotes.content,
          version: channelNotes.version,
          updatedBy: channelNotes.updatedBy,
          updatedByName: users.name,
        })
        .from(channelNotes)
        .leftJoin(users, eq(channelNotes.updatedBy, users.id))
        .where(eq(channelNotes.channelId, channelId))
        .limit(1);

      return NextResponse.json(
        {
          success: false,
          conflict: {
            serverContent: currentNote[0]?.content || "",
            serverVersion: currentNote[0]?.version || 1,
            editedBy: currentNote[0]?.updatedBy,
            editedByName: currentNote[0]?.updatedByName || "Another user",
          },
        },
        { status: 409 }
      );
    }

    // Success - return new version
    return NextResponse.json({
      success: true,
      newVersion: result[0].version,
    });
  } catch (error) {
    console.error("Save channel note error:", error);
    return NextResponse.json(
      { error: "Failed to save channel note" },
      { status: 500 }
    );
  }
}

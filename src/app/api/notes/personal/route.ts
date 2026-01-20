import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { personalNotes } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * GET /api/notes/personal?workspaceId=X - Get personal note content
 * Returns note content and version for the current user in the specified workspace.
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
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    // Query personal note for this user and workspace
    const note = await db.query.personalNotes.findFirst({
      where: and(
        eq(personalNotes.userId, session.user.id),
        eq(personalNotes.organizationId, workspaceId)
      ),
    });

    // If no note exists, return empty note (will be created on first save)
    if (!note) {
      return NextResponse.json({
        content: "",
        version: 0,
        updatedAt: null,
      });
    }

    return NextResponse.json({
      content: note.content,
      version: note.version,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    console.error("Get personal note error:", error);
    return NextResponse.json(
      { error: "Failed to get personal note" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notes/personal - Save personal note with optimistic locking
 * Body: { workspaceId, content, baseVersion }
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
    const { workspaceId, content, baseVersion } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
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

    // If baseVersion is 0, this is a new note - INSERT
    if (baseVersion === 0) {
      const [inserted] = await db
        .insert(personalNotes)
        .values({
          userId: session.user.id,
          organizationId: workspaceId,
          content,
          version: 1,
        })
        .onConflictDoNothing()
        .returning({ version: personalNotes.version });

      // If insert returned nothing, note was created in another tab/device concurrently
      if (!inserted) {
        // Fetch the current note to return conflict info
        const currentNote = await db.query.personalNotes.findFirst({
          where: and(
            eq(personalNotes.userId, session.user.id),
            eq(personalNotes.organizationId, workspaceId)
          ),
        });

        return NextResponse.json(
          {
            success: false,
            conflict: {
              serverContent: currentNote?.content || "",
              serverVersion: currentNote?.version || 1,
              // Personal notes are edited by the same user, so no editedBy name needed
              editedBy: session.user.id,
              editedByName: "you (from another device/tab)",
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
      .update(personalNotes)
      .set({
        content,
        version: sql`${personalNotes.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(personalNotes.userId, session.user.id),
          eq(personalNotes.organizationId, workspaceId),
          eq(personalNotes.version, baseVersion) // Only update if version matches
        )
      )
      .returning({ version: personalNotes.version });

    // If no rows updated, version mismatch (conflict)
    if (result.length === 0) {
      // Fetch current note to return conflict info
      const currentNote = await db.query.personalNotes.findFirst({
        where: and(
          eq(personalNotes.userId, session.user.id),
          eq(personalNotes.organizationId, workspaceId)
        ),
      });

      return NextResponse.json(
        {
          success: false,
          conflict: {
            serverContent: currentNote?.content || "",
            serverVersion: currentNote?.version || 1,
            editedBy: session.user.id,
            editedByName: "you (from another device/tab)",
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
    console.error("Save personal note error:", error);
    return NextResponse.json(
      { error: "Failed to save personal note" },
      { status: 500 }
    );
  }
}

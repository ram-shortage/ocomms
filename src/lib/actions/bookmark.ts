"use server";

import { db } from "@/db";
import { bookmarks, messages, fileAttachments, channelMembers, conversationParticipants } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type BookmarkType = "message" | "file";

interface ToggleBookmarkInput {
  type: BookmarkType;
  messageId?: string;
  fileId?: string;
}

/**
 * Verify user has access to a message (via channel membership or DM participation)
 */
async function verifyMessageAccess(userId: string, messageId: string): Promise<boolean> {
  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  });

  if (!message) return false;

  // Check channel membership
  if (message.channelId) {
    const membership = await db.query.channelMembers.findFirst({
      where: and(
        eq(channelMembers.channelId, message.channelId),
        eq(channelMembers.userId, userId)
      ),
    });
    return !!membership;
  }

  // Check DM participation
  if (message.conversationId) {
    const participation = await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, message.conversationId),
        eq(conversationParticipants.userId, userId)
      ),
    });
    return !!participation;
  }

  return false;
}

/**
 * Toggle bookmark on a message or file
 * BOOK-01: Save messages or files to bookmarks
 */
export async function toggleBookmark(input: ToggleBookmarkInput) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const { type, messageId, fileId } = input;

  // Validate input
  if (type === "message" && !messageId) {
    throw new Error("messageId required for message bookmarks");
  }
  if (type === "file" && !fileId) {
    throw new Error("fileId required for file bookmarks");
  }

  // Verify access to the item
  if (type === "message" && messageId) {
    const hasAccess = await verifyMessageAccess(session.user.id, messageId);
    if (!hasAccess) {
      throw new Error("Message not found or access denied");
    }
  }

  if (type === "file" && fileId) {
    // Verify file exists
    const file = await db.query.fileAttachments.findFirst({
      where: eq(fileAttachments.id, fileId),
    });
    if (!file) {
      throw new Error("File not found");
    }
    // If file is attached to a message, verify message access
    if (file.messageId) {
      const hasAccess = await verifyMessageAccess(session.user.id, file.messageId);
      if (!hasAccess) {
        throw new Error("File not found or access denied");
      }
    }
  }

  // Build where clause based on type
  const whereClause = type === "message"
    ? and(
        eq(bookmarks.userId, session.user.id),
        eq(bookmarks.messageId, messageId!)
      )
    : and(
        eq(bookmarks.userId, session.user.id),
        eq(bookmarks.fileId, fileId!)
      );

  // Check if bookmark exists
  const existing = await db.query.bookmarks.findFirst({
    where: whereClause,
  });

  if (existing) {
    // Remove bookmark
    await db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
    revalidatePath("/");
    return { bookmarked: false };
  } else {
    // Add bookmark
    await db.insert(bookmarks).values({
      userId: session.user.id,
      type,
      messageId: type === "message" ? messageId : null,
      fileId: type === "file" ? fileId : null,
    });
    revalidatePath("/");
    return { bookmarked: true };
  }
}

/**
 * Get all bookmarks for the current user
 * BOOK-03: View list of bookmarked items
 */
export async function getBookmarks() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const userBookmarks = await db.query.bookmarks.findMany({
    where: eq(bookmarks.userId, session.user.id),
    with: {
      message: {
        with: {
          author: true,
          channel: {
            columns: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      },
      file: {
        with: {
          uploader: true,
          message: {
            with: {
              channel: {
                columns: {
                  id: true,
                  slug: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: (bookmarks, { desc }) => [desc(bookmarks.createdAt)],
  });

  return userBookmarks;
}

/**
 * Check if a message is bookmarked by the current user
 * BOOK-02: Visual indicator for bookmarked messages
 */
export async function isBookmarked(messageId: string): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return false;

  const bookmark = await db.query.bookmarks.findFirst({
    where: and(
      eq(bookmarks.userId, session.user.id),
      eq(bookmarks.messageId, messageId)
    ),
  });

  return !!bookmark;
}

/**
 * Get message IDs that are bookmarked by the current user
 * Used for highlighting bookmark indicators in message list
 */
export async function getBookmarkedMessageIds(): Promise<string[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return [];

  const userBookmarks = await db.query.bookmarks.findMany({
    where: and(
      eq(bookmarks.userId, session.user.id),
      eq(bookmarks.type, "message")
    ),
    columns: {
      messageId: true,
    },
  });

  return userBookmarks
    .map((b) => b.messageId)
    .filter((id): id is string => id !== null);
}

/**
 * Remove a bookmark by ID
 * BOOK-04: Remove bookmark from list
 */
export async function removeBookmark(bookmarkId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify ownership before deletion
  const bookmark = await db.query.bookmarks.findFirst({
    where: and(
      eq(bookmarks.id, bookmarkId),
      eq(bookmarks.userId, session.user.id)
    ),
  });

  if (!bookmark) {
    throw new Error("Bookmark not found");
  }

  await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId));

  revalidatePath("/");
  return { removed: true };
}

"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { customEmojis, members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { unlink } from "fs/promises";
import { join } from "path";

export interface CustomEmoji {
  id: string;
  name: string;
  path: string;
  isAnimated: boolean;
  uploadedBy: string;
  createdAt: Date;
}

/**
 * Get all custom emojis for a workspace.
 * Returns array suitable for emoji picker integration.
 */
export async function getWorkspaceEmojis(workspaceId: string): Promise<CustomEmoji[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Verify user is member of workspace
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, workspaceId)
    ),
  });

  if (!membership) {
    throw new Error("Not a member of workspace");
  }

  const emojis = await db.query.customEmojis.findMany({
    where: eq(customEmojis.workspaceId, workspaceId),
    orderBy: (emoji, { asc }) => [asc(emoji.name)],
  });

  return emojis.map((e) => ({
    id: e.id,
    name: e.name,
    path: e.path,
    isAnimated: e.isAnimated,
    uploadedBy: e.uploadedBy,
    createdAt: e.createdAt,
  }));
}

/**
 * Delete a custom emoji.
 * EMOJ-06: User can delete own uploaded emoji.
 * Admins can delete any emoji.
 */
export async function deleteCustomEmoji(
  emojiId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Fetch emoji
  const emoji = await db.query.customEmojis.findFirst({
    where: eq(customEmojis.id, emojiId),
  });

  if (!emoji) {
    return { success: false, error: "Emoji not found" };
  }

  // Check permissions: own emoji or admin
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, emoji.workspaceId)
    ),
    columns: { role: true },
  });

  if (!membership) {
    return { success: false, error: "Not a member of workspace" };
  }

  const isOwner = emoji.uploadedBy === session.user.id;
  const isAdmin = membership.role === "admin" || membership.role === "owner";

  if (!isOwner && !isAdmin) {
    return { success: false, error: "Can only delete your own emoji or be admin" };
  }

  // Delete file from disk
  try {
    const filepath = join(process.cwd(), "public", emoji.path);
    await unlink(filepath);
  } catch (error) {
    // File may not exist, continue with DB deletion
    console.warn("Failed to delete emoji file:", error);
  }

  // Delete from database
  await db.delete(customEmojis).where(eq(customEmojis.id, emojiId));

  return { success: true };
}

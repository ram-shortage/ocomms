"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { linkPreviews, messageLinkPreviews, messages } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface LinkPreview {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  position: number;
  hidden: boolean;
}

/**
 * Get all link previews for a message.
 * Returns non-hidden previews ordered by position.
 */
export async function getMessagePreviews(messageId: string): Promise<LinkPreview[]> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Unauthorized");
  }

  const results = await db
    .select({
      id: linkPreviews.id,
      url: linkPreviews.url,
      title: linkPreviews.title,
      description: linkPreviews.description,
      imageUrl: linkPreviews.imageUrl,
      siteName: linkPreviews.siteName,
      position: messageLinkPreviews.position,
      hidden: messageLinkPreviews.hidden,
    })
    .from(messageLinkPreviews)
    .innerJoin(linkPreviews, eq(messageLinkPreviews.linkPreviewId, linkPreviews.id))
    .where(
      and(
        eq(messageLinkPreviews.messageId, messageId),
        eq(messageLinkPreviews.hidden, false)
      )
    )
    .orderBy(messageLinkPreviews.position);

  return results;
}

/**
 * Hide a link preview on a message the user owns.
 * LINK-06: User can dismiss/remove preview from message.
 */
export async function hideLinkPreview(
  messageId: string,
  previewId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  // Verify user owns the message
  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
    columns: { authorId: true },
  });

  if (!message) {
    return { success: false, error: "Message not found" };
  }

  if (message.authorId !== session.user.id) {
    return { success: false, error: "Can only hide previews on your own messages" };
  }

  // Mark preview as hidden for this message
  await db
    .update(messageLinkPreviews)
    .set({ hidden: true })
    .where(
      and(
        eq(messageLinkPreviews.messageId, messageId),
        eq(messageLinkPreviews.linkPreviewId, previewId)
      )
    );

  return { success: true };
}

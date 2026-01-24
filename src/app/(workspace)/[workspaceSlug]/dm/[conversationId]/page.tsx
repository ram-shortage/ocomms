import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getConversation } from "@/lib/actions/conversation";
import { getUserGroups } from "@/lib/actions/user-group";
import { DMHeader } from "@/components/dm/dm-header";
import { DMContent } from "@/components/dm/dm-content";
import { db } from "@/db";
import { messages, users, fileAttachments, members } from "@/db/schema";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import type { Message, Attachment } from "@/lib/socket-events";

export default async function DMPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; conversationId: string }>;
}) {
  const { workspaceSlug, conversationId } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get organization by slug
  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  });

  const workspace = orgs?.find((org) => org.slug === workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const conversation = await getConversation(conversationId);

  if (!conversation) {
    notFound();
  }

  // Verify conversation belongs to this workspace
  if (conversation.organizationId !== workspace.id) {
    notFound();
  }

  // Fetch initial messages for this conversation (only top-level messages, not thread replies)
  const conversationMessages = await db
    .select({
      id: messages.id,
      content: messages.content,
      authorId: messages.authorId,
      channelId: messages.channelId,
      conversationId: messages.conversationId,
      parentId: messages.parentId,
      replyCount: messages.replyCount,
      sequence: messages.sequence,
      deletedAt: messages.deletedAt,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt), isNull(messages.parentId)))
    .orderBy(desc(messages.sequence))
    .limit(50);

  // FILE-04/FILE-05: Fetch attachments for these messages
  const messageIds = conversationMessages.map((m) => m.id);
  const attachmentsData = messageIds.length > 0
    ? await db
        .select({
          id: fileAttachments.id,
          messageId: fileAttachments.messageId,
          originalName: fileAttachments.originalName,
          path: fileAttachments.path,
          mimeType: fileAttachments.mimeType,
          sizeBytes: fileAttachments.sizeBytes,
          isImage: fileAttachments.isImage,
        })
        .from(fileAttachments)
        .where(inArray(fileAttachments.messageId, messageIds))
    : [];

  // Group attachments by messageId
  const attachmentsByMessageId = new Map<string, Attachment[]>();
  for (const a of attachmentsData) {
    if (a.messageId) {
      const existing = attachmentsByMessageId.get(a.messageId) || [];
      existing.push({
        id: a.id,
        originalName: a.originalName,
        path: a.path,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        isImage: a.isImage,
      });
      attachmentsByMessageId.set(a.messageId, existing);
    }
  }

  // GUST-03: Fetch guest status for message authors
  const uniqueAuthorIds = [...new Set(conversationMessages.map((m) => m.authorId))];
  const guestStatusMap = new Map<string, boolean>();
  if (uniqueAuthorIds.length > 0) {
    const guestMembers = await db
      .select({ userId: members.userId, isGuest: members.isGuest })
      .from(members)
      .where(and(
        inArray(members.userId, uniqueAuthorIds),
        eq(members.organizationId, workspace.id)
      ));
    for (const m of guestMembers) {
      guestStatusMap.set(m.userId, m.isGuest ?? false);
    }
  }

  // Transform to Message type for client
  // Reverse from DESC order back to chronological for display (oldest first)
  const initialMessages: Message[] = conversationMessages.reverse().map((m) => ({
    id: m.id,
    content: m.content,
    authorId: m.authorId,
    channelId: m.channelId,
    conversationId: m.conversationId,
    parentId: m.parentId,
    replyCount: m.replyCount,
    sequence: m.sequence,
    deletedAt: m.deletedAt,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    author: {
      id: m.authorId,
      name: m.authorName,
      email: m.authorEmail || "",
      isGuest: guestStatusMap.get(m.authorId) ?? false,
    },
    attachments: attachmentsByMessageId.get(m.id),
  }));

  // UGRP-02: Fetch user groups for mention autocomplete
  const userGroups = await getUserGroups(workspace.id);
  const groups = userGroups.map((g) => ({
    id: g.id,
    name: g.name,
    handle: g.handle,
    memberCount: g.memberCount,
  }));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <DMHeader
        conversation={conversation}
        organizationId={workspace.id}
        workspaceSlug={workspaceSlug}
        currentUserId={session.user.id}
      />

      <DMContent
        conversationId={conversationId}
        initialMessages={initialMessages}
        currentUserId={session.user.id}
        currentUsername={session.user.name || session.user.email.split("@")[0]}
        members={conversation.participants.map((p) => ({
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
        }))}
        groups={groups}
      />
    </div>
  );
}

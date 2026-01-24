import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getChannel } from "@/lib/actions/channel";
import { getWorkspaceEmojis } from "@/lib/actions/custom-emoji";
import { getUserGroups } from "@/lib/actions/user-group";
import { ChannelHeader } from "@/components/channel/channel-header";
import { ChannelContent } from "@/components/channel/channel-content";
import { db } from "@/db";
import { messages, users, pinnedMessages, channelNotificationSettings, fileAttachments, messageLinkPreviews, linkPreviews, members } from "@/db/schema";
import { eq, and, isNull, asc, desc, inArray } from "drizzle-orm";
import type { Message, Attachment } from "@/lib/socket-events";
import type { NotificationMode } from "@/db/schema/channel-notification-settings";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; channelSlug: string }>;
}) {
  const { workspaceSlug, channelSlug } = await params;

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

  const channel = await getChannel(workspace.id, channelSlug);

  if (!channel) {
    notFound();
  }

  // Find current user's membership
  const currentMembership = channel.members.find(
    (m) => m.userId === session.user.id
  );

  const isAdmin = currentMembership?.role === "admin";

  // Fetch initial messages for this channel (only top-level messages, not thread replies)
  const channelMessages = await db
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
    .where(and(eq(messages.channelId, channel.id), isNull(messages.deletedAt), isNull(messages.parentId)))
    .orderBy(desc(messages.sequence))
    .limit(50);

  // FILE-04/FILE-05: Fetch attachments for these messages
  const messageIds = channelMessages.map((m) => m.id);
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

  // LINK-01: Fetch link previews for these messages
  const linkPreviewsData = messageIds.length > 0
    ? await db
        .select({
          messageId: messageLinkPreviews.messageId,
          previewId: linkPreviews.id,
          url: linkPreviews.url,
          title: linkPreviews.title,
          description: linkPreviews.description,
          imageUrl: linkPreviews.imageUrl,
          siteName: linkPreviews.siteName,
          hidden: messageLinkPreviews.hidden,
          position: messageLinkPreviews.position,
        })
        .from(messageLinkPreviews)
        .innerJoin(linkPreviews, eq(messageLinkPreviews.linkPreviewId, linkPreviews.id))
        .where(and(
          inArray(messageLinkPreviews.messageId, messageIds),
          eq(messageLinkPreviews.hidden, false)
        ))
        .orderBy(asc(messageLinkPreviews.position))
    : [];

  // Group link previews by messageId
  type LinkPreview = { id: string; url: string; title: string | null; description: string | null; imageUrl: string | null; siteName: string | null };
  const linkPreviewsByMessageId = new Map<string, LinkPreview[]>();
  for (const lp of linkPreviewsData) {
    if (lp.messageId) {
      const existing = linkPreviewsByMessageId.get(lp.messageId) || [];
      existing.push({
        id: lp.previewId,
        url: lp.url,
        title: lp.title,
        description: lp.description,
        imageUrl: lp.imageUrl,
        siteName: lp.siteName,
      });
      linkPreviewsByMessageId.set(lp.messageId, existing);
    }
  }

  // GUST-03: Fetch guest status for message authors
  const uniqueAuthorIds = [...new Set(channelMessages.map((m) => m.authorId))];
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
  const initialMessages: Message[] = channelMessages.reverse().map((m) => ({
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
    linkPreviews: linkPreviewsByMessageId.get(m.id),
  }));

  // Fetch pinned message IDs for this channel
  const pinnedMessagesData = await db
    .select({ messageId: pinnedMessages.messageId })
    .from(pinnedMessages)
    .innerJoin(messages, eq(pinnedMessages.messageId, messages.id))
    .where(
      and(
        eq(pinnedMessages.channelId, channel.id),
        isNull(messages.deletedAt)
      )
    );

  const initialPinnedMessageIds = pinnedMessagesData.map((p) => p.messageId);

  // Fetch notification settings for current user in this channel
  const notificationSettingsData = await db.query.channelNotificationSettings.findFirst({
    where: and(
      eq(channelNotificationSettings.channelId, channel.id),
      eq(channelNotificationSettings.userId, session.user.id)
    ),
  });

  // No settings = "all" mode (default)
  const notificationMode: NotificationMode = (notificationSettingsData?.mode as NotificationMode) ?? "all";

  // EMOJ-02: Fetch custom emojis for emoji picker
  const workspaceEmojis = await getWorkspaceEmojis(workspace.id);
  const customEmojis = workspaceEmojis.map((e) => ({
    id: e.id,
    name: e.name,
    path: e.path,
    isAnimated: e.isAnimated,
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
      <ChannelHeader
        channel={{
          id: channel.id,
          name: channel.name,
          slug: channel.slug,
          topic: channel.topic,
          description: channel.description,
          isPrivate: channel.isPrivate,
          memberCount: channel.members.length,
        }}
        organizationId={workspace.id}
        workspaceSlug={workspaceSlug}
        isAdmin={isAdmin}
        members={channel.members.map((m) => ({
          id: m.userId,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
        }))}
        currentUserId={session.user.id}
        notificationMode={notificationMode}
      />

      <ChannelContent
        channelId={channel.id}
        organizationId={workspace.id}
        initialMessages={initialMessages}
        initialPinnedMessageIds={initialPinnedMessageIds}
        currentUserId={session.user.id}
        currentUsername={session.user.name || session.user.email.split("@")[0]}
        members={channel.members.map((m) => ({
          id: m.userId,
          name: m.user.name,
          email: m.user.email,
        }))}
        groups={groups}
        isArchived={channel.isArchived}
        customEmojis={customEmojis}
      />
    </div>
  );
}

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getChannel } from "@/lib/actions/channel";
import { ChannelHeader } from "@/components/channel/channel-header";
import { MessageList, MessageInput } from "@/components/message";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import type { Message } from "@/lib/socket-events";

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
    .orderBy(asc(messages.sequence))
    .limit(50);

  // Transform to Message type for client
  const initialMessages: Message[] = channelMessages.map((m) => ({
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
    },
  }));

  return (
    <div className="flex flex-col h-screen">
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
      />

      {/* Message list - grows to fill available space */}
      <MessageList
        initialMessages={initialMessages}
        targetId={channel.id}
        targetType="channel"
        currentUserId={session.user.id}
      />

      {/* Message input - fixed at bottom */}
      <MessageInput targetId={channel.id} targetType="channel" />
    </div>
  );
}

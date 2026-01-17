import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getConversation } from "@/lib/actions/conversation";
import { DMHeader } from "@/components/dm/dm-header";
import { MessageList, MessageInput } from "@/components/message";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import type { Message } from "@/lib/socket-events";

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

  // Fetch initial messages for this conversation
  const conversationMessages = await db
    .select({
      id: messages.id,
      content: messages.content,
      authorId: messages.authorId,
      channelId: messages.channelId,
      conversationId: messages.conversationId,
      sequence: messages.sequence,
      deletedAt: messages.deletedAt,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
    .orderBy(asc(messages.sequence))
    .limit(50);

  // Transform to Message type for client
  const initialMessages: Message[] = conversationMessages.map((m) => ({
    id: m.id,
    content: m.content,
    authorId: m.authorId,
    channelId: m.channelId,
    conversationId: m.conversationId,
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
      <DMHeader
        conversation={conversation}
        organizationId={workspace.id}
        workspaceSlug={workspaceSlug}
        currentUserId={session.user.id}
      />

      {/* Message list - grows to fill available space */}
      <MessageList
        initialMessages={initialMessages}
        targetId={conversationId}
        targetType="dm"
        currentUserId={session.user.id}
      />

      {/* Message input - fixed at bottom */}
      <MessageInput targetId={conversationId} targetType="dm" />
    </div>
  );
}

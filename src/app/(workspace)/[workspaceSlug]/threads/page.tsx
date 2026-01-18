import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { threadParticipants, messages, users } from "@/db/schema";
import { eq, desc, isNull, and } from "drizzle-orm";
import { ThreadList } from "@/components/thread/thread-list";

interface ThreadPreview {
  threadId: string;
  parentContent: string;
  parentAuthorName: string | null;
  parentAuthorEmail: string;
  replyCount: number;
  lastReplyAt: Date;
  channelId: string | null;
  conversationId: string | null;
}

async function getThreadsForUser(userId: string, organizationId: string): Promise<ThreadPreview[]> {
  // Get threads the user participates in
  const participations = await db
    .select({
      threadId: threadParticipants.threadId,
    })
    .from(threadParticipants)
    .where(eq(threadParticipants.userId, userId));

  if (participations.length === 0) {
    return [];
  }

  const threadIds = participations.map((p) => p.threadId);

  // Get parent messages for these threads
  const threadsWithDetails = await Promise.all(
    threadIds.map(async (threadId) => {
      const [parent] = await db
        .select({
          id: messages.id,
          content: messages.content,
          replyCount: messages.replyCount,
          channelId: messages.channelId,
          conversationId: messages.conversationId,
          authorName: users.name,
          authorEmail: users.email,
        })
        .from(messages)
        .leftJoin(users, eq(messages.authorId, users.id))
        .where(and(eq(messages.id, threadId), isNull(messages.deletedAt)))
        .limit(1);

      if (!parent) return null;

      // Get most recent reply time
      const [latestReply] = await db
        .select({
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(and(eq(messages.parentId, threadId), isNull(messages.deletedAt)))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return {
        threadId: parent.id,
        parentContent: parent.content,
        parentAuthorName: parent.authorName,
        parentAuthorEmail: parent.authorEmail || "",
        replyCount: parent.replyCount,
        lastReplyAt: latestReply?.createdAt || new Date(),
        channelId: parent.channelId,
        conversationId: parent.conversationId,
      };
    })
  );

  // Filter out nulls and sort by last reply time
  return threadsWithDetails
    .filter((t): t is ThreadPreview => t !== null)
    .sort((a, b) => new Date(b.lastReplyAt).getTime() - new Date(a.lastReplyAt).getTime())
    .slice(0, 20); // Limit to 20 threads
}

export default async function ThreadsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

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

  const threads = await getThreadsForUser(session.user.id, workspace.id);

  return (
    <div className="flex h-screen">
      <main className="flex-1 flex flex-col">
        <div className="border-b px-6 py-4">
          <h1 className="text-xl font-bold">Threads</h1>
          <p className="text-sm text-muted-foreground">
            Conversations you are participating in
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <p className="text-lg text-muted-foreground mb-2">
                No threads yet
              </p>
              <p className="text-sm text-muted-foreground">
                Reply to a message to start a thread
              </p>
            </div>
          ) : (
            <ThreadList
              threads={threads}
              currentUserId={session.user.id}
              workspaceSlug={workspaceSlug}
            />
          )}
        </div>
      </main>
    </div>
  );
}

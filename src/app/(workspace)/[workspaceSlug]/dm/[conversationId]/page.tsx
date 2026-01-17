import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getConversation } from "@/lib/actions/conversation";
import { DMHeader } from "@/components/dm/dm-header";

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

  return (
    <div className="flex flex-col h-screen">
      <DMHeader
        conversation={conversation}
        organizationId={workspace.id}
        workspaceSlug={workspaceSlug}
        currentUserId={session.user.id}
      />
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Messages coming in Phase 3</p>
          <p className="text-sm">This conversation is ready for messaging</p>
        </div>
      </div>
    </div>
  );
}

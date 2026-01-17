import { getUserConversations } from "@/lib/actions/conversation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { DMListItem } from "./dm-list-item";

interface DMListProps {
  organizationId: string;
  workspaceSlug: string;
}

export async function DMList({ organizationId, workspaceSlug }: DMListProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const conversations = await getUserConversations(organizationId);

  if (conversations.length === 0) {
    return (
      <div className="px-2 py-3 text-sm text-gray-500">
        No direct messages yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conversation) => {
        // For 1:1, show other person's name
        // For group, show group name or participant names
        const otherParticipants = conversation.participants.filter(
          (p) => p.userId !== session.user.id
        );

        let displayName: string;
        if (conversation.isGroup) {
          displayName =
            conversation.name ||
            otherParticipants
              .map((p) => p.user.name || p.user.email)
              .slice(0, 3)
              .join(", ");
          if (otherParticipants.length > 3) {
            displayName += ` +${otherParticipants.length - 3}`;
          }
        } else {
          const other = otherParticipants[0];
          displayName = other?.user.name || other?.user.email || "Unknown";
        }

        return (
          <DMListItem
            key={conversation.id}
            conversationId={conversation.id}
            workspaceSlug={workspaceSlug}
            isGroup={conversation.isGroup}
            displayName={displayName}
            otherUserId={!conversation.isGroup ? otherParticipants[0]?.userId : undefined}
            participantCount={conversation.isGroup ? otherParticipants.length + 1 : undefined}
          />
        );
      })}
    </div>
  );
}

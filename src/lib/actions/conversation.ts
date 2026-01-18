"use server";

import { db } from "@/db";
import { conversations, conversationParticipants, members } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function verifyOrgMembership(userId: string, organizationId: string): Promise<boolean> {
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });
  return !!membership;
}

export async function createConversation(formData: {
  organizationId: string;
  participantIds: string[];
  name?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify requester is member of target organization
  const isRequesterMember = await verifyOrgMembership(session.user.id, formData.organizationId);
  if (!isRequesterMember) {
    throw new Error("Not authorized to create conversations in this organization");
  }

  // Verify all participants are members of the organization
  for (const participantId of formData.participantIds) {
    const isParticipantMember = await verifyOrgMembership(participantId, formData.organizationId);
    if (!isParticipantMember) {
      throw new Error("All participants must be members of the organization");
    }
  }

  const allParticipantIds = [...new Set([session.user.id, ...formData.participantIds])];
  const isGroup = allParticipantIds.length > 2;

  // For 1:1, check if conversation already exists
  if (!isGroup) {
    const existingConversations = await db.query.conversations.findMany({
      where: and(
        eq(conversations.organizationId, formData.organizationId),
        eq(conversations.isGroup, false)
      ),
      with: {
        participants: true,
      },
    });

    const existing = existingConversations.find((conv) => {
      const participantUserIds = conv.participants.map((p) => p.userId).sort();
      const targetIds = allParticipantIds.sort();
      return (
        participantUserIds.length === targetIds.length &&
        participantUserIds.every((id, i) => id === targetIds[i])
      );
    });

    if (existing) {
      return existing;
    }
  }

  // Create conversation and add participants
  const [conversation] = await db.transaction(async (tx) => {
    const [newConv] = await tx.insert(conversations).values({
      organizationId: formData.organizationId,
      isGroup,
      name: isGroup ? formData.name || null : null,
      createdBy: session.user.id,
    }).returning();

    await tx.insert(conversationParticipants).values(
      allParticipantIds.map((userId) => ({
        conversationId: newConv.id,
        userId,
      }))
    );

    return [newConv];
  });

  revalidatePath(`/`);
  return conversation;
}

export async function getUserConversations(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const participations = await db.query.conversationParticipants.findMany({
    where: eq(conversationParticipants.userId, session.user.id),
    with: {
      conversation: {
        with: {
          participants: {
            with: {
              user: true,
            },
          },
        },
      },
    },
  });

  return participations
    .filter((p) => p.conversation.organizationId === organizationId)
    .map((p) => p.conversation);
}

export async function getConversation(conversationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      participants: {
        with: {
          user: true,
        },
      },
    },
  });

  if (!conversation) return null;

  // Check user is participant
  const isParticipant = conversation.participants.some(
    (p) => p.userId === session.user.id
  );

  if (!isParticipant) return null;

  return conversation;
}

export async function getWorkspaceMembers(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const fullOrg = await auth.api.getFullOrganization({
    query: { organizationId },
    headers: await headers(),
  });

  if (!fullOrg) return [];

  return (fullOrg.members || []).map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role as "owner" | "admin" | "member",
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
    },
  }));
}

export async function addParticipant(conversationId: string, userId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify requester is participant
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      participants: true,
    },
  });

  if (!conversation) throw new Error("Conversation not found");

  const isParticipant = conversation.participants.some(
    (p) => p.userId === session.user.id
  );
  if (!isParticipant) throw new Error("Not a participant");

  // Verify new participant is member of the conversation's organization
  const isNewMemberInOrg = await verifyOrgMembership(userId, conversation.organizationId);
  if (!isNewMemberInOrg) {
    throw new Error("User must be a member of the organization");
  }

  // Adding to 1:1 converts it to group DM
  if (!conversation.isGroup) {
    await db.update(conversations)
      .set({ isGroup: true, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  // Add participant
  await db.insert(conversationParticipants).values({
    conversationId,
    userId,
  }).onConflictDoNothing();

  revalidatePath(`/`);
  return { success: true };
}

export async function setConversationName(conversationId: string, name: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify requester is participant
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: {
      participants: true,
    },
  });

  if (!conversation) throw new Error("Conversation not found");
  if (!conversation.isGroup) throw new Error("Cannot name 1:1 conversations");

  const isParticipant = conversation.participants.some(
    (p) => p.userId === session.user.id
  );
  if (!isParticipant) throw new Error("Not a participant");

  await db.update(conversations)
    .set({ name: name || null, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  revalidatePath(`/`);
  return { success: true };
}

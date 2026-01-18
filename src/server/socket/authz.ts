import { db } from "@/db";
import {
  channelMembers,
  conversationParticipants,
  members,
  messages,
  channels,
  conversations,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Authorization helpers for Socket.IO handlers.
 * Provides reusable membership validation to ensure consistent authorization checks.
 */

/**
 * Check if a user is a member of a channel.
 * @param userId - The user's ID
 * @param channelId - The channel's ID
 * @returns true if the user is a member, false otherwise
 */
export async function isChannelMember(
  userId: string,
  channelId: string
): Promise<boolean> {
  const membership = await db
    .select()
    .from(channelMembers)
    .where(
      and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId))
    )
    .limit(1);

  return membership.length > 0;
}

/**
 * Check if a user is a participant in a conversation.
 * @param userId - The user's ID
 * @param conversationId - The conversation's ID
 * @returns true if the user is a participant, false otherwise
 */
export async function isConversationParticipant(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const participation = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      )
    )
    .limit(1);

  return participation.length > 0;
}

/**
 * Check if a user is a member of an organization.
 * @param userId - The user's ID
 * @param organizationId - The organization's ID
 * @returns true if the user is a member, false otherwise
 */
export async function isOrganizationMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const membership = await db
    .select()
    .from(members)
    .where(
      and(eq(members.organizationId, organizationId), eq(members.userId, userId))
    )
    .limit(1);

  return membership.length > 0;
}

/**
 * Get the context (channel or conversation) for a message.
 * Useful for thread/reaction handlers that receive a messageId.
 * @param messageId - The message's ID
 * @returns Object with channelId/conversationId if found, null if not found
 */
export async function getMessageContext(
  messageId: string
): Promise<{ channelId: string | null; conversationId: string | null } | null> {
  const [message] = await db
    .select({
      channelId: messages.channelId,
      conversationId: messages.conversationId,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message) {
    return null;
  }

  return {
    channelId: message.channelId,
    conversationId: message.conversationId,
  };
}

/**
 * Get the organization ID for a channel.
 * @param channelId - The channel's ID
 * @returns The organization ID if found, null if not found
 */
export async function getChannelOrganization(
  channelId: string
): Promise<string | null> {
  const [channel] = await db
    .select({ organizationId: channels.organizationId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  return channel?.organizationId ?? null;
}

/**
 * Get the organization ID for a conversation.
 * @param conversationId - The conversation's ID
 * @returns The organization ID if found, null if not found
 */
export async function getConversationOrganization(
  conversationId: string
): Promise<string | null> {
  const [conversation] = await db
    .select({ organizationId: conversations.organizationId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  return conversation?.organizationId ?? null;
}

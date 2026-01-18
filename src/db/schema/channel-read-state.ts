import { pgTable, uuid, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./auth";
import { channels } from "./channel";
import { conversations } from "./conversation";

/**
 * Tracks read position per user per channel/conversation.
 *
 * Pattern: Store lastReadSequence (the sequence number of the last read message).
 * Unread count = MAX(message.sequence) - lastReadSequence
 *
 * For "mark as unread": store markedUnreadAtSequence to override lastReadSequence.
 * When markedUnreadAtSequence is set, effectiveReadSeq = MIN(lastReadSequence, markedUnreadAtSequence - 1)
 */
export const channelReadState = pgTable("channel_read_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Either channel or conversation, not both
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),

  // The sequence number of the last message the user has read
  lastReadSequence: integer("last_read_sequence").notNull().default(0),

  // If user marks a message as unread, this stores that message's sequence
  // When set, effective read position = MIN(lastReadSequence, markedUnreadAtSequence - 1)
  markedUnreadAtSequence: integer("marked_unread_at_sequence"),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Unique: one read state per user per channel
  uniqueIndex("channel_read_state_user_channel_idx")
    .on(table.userId, table.channelId)
    .where(sql`channel_id IS NOT NULL`),
  // Unique: one read state per user per conversation
  uniqueIndex("channel_read_state_user_conv_idx")
    .on(table.userId, table.conversationId)
    .where(sql`conversation_id IS NOT NULL`),
  // Index for fetching all user's read states
  index("channel_read_state_user_idx").on(table.userId),
]);

export const channelReadStateRelations = relations(channelReadState, ({ one }) => ({
  user: one(users, {
    fields: [channelReadState.userId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [channelReadState.channelId],
    references: [channels.id],
  }),
  conversation: one(conversations, {
    fields: [channelReadState.conversationId],
    references: [conversations.id],
  }),
}));

import { pgTable, uuid, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { messages } from "./message";
import { channels } from "./channel";
import { users } from "./auth";

export const pinnedMessages = pgTable("pinned_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  pinnedBy: uuid("pinned_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pinnedAt: timestamp("pinned_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("pinned_messages_unique_idx").on(table.messageId, table.channelId),
  index("pinned_messages_channel_idx").on(table.channelId),
]);

export const pinnedMessagesRelations = relations(pinnedMessages, ({ one }) => ({
  message: one(messages, {
    fields: [pinnedMessages.messageId],
    references: [messages.id],
  }),
  channel: one(channels, {
    fields: [pinnedMessages.channelId],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [pinnedMessages.pinnedBy],
    references: [users.id],
  }),
}));

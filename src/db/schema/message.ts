import { pgTable, text, timestamp, uuid, integer, index, type AnyPgColumn, customType } from "drizzle-orm/pg-core";
import { relations, SQL, sql } from "drizzle-orm";
import { users } from "./auth";
import { channels } from "./channel";
import { conversations } from "./conversation";

export const tsvector = customType<{ data: string }>({
  dataType() {
    return `tsvector`;
  },
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => messages.id, { onDelete: "cascade" }),
  replyCount: integer("reply_count").notNull().default(0),
  sequence: integer("sequence").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  searchContent: tsvector("search_content")
    .generatedAlwaysAs((): SQL => sql`to_tsvector('english', ${messages.content})`),
}, (table) => [
  index("messages_channel_seq_idx").on(table.channelId, table.sequence),
  index("messages_conversation_seq_idx").on(table.conversationId, table.sequence),
  index("messages_author_idx").on(table.authorId),
  index("messages_parent_idx").on(table.parentId),
  index("messages_search_idx").using("gin", table.searchContent),
]);

export const messagesRelations = relations(messages, ({ one, many }) => ({
  author: one(users, {
    fields: [messages.authorId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  parent: one(messages, {
    fields: [messages.parentId],
    references: [messages.id],
    relationName: "thread",
  }),
  replies: many(messages, { relationName: "thread" }),
}));

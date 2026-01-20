import { pgTable, text, timestamp, uuid, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { channels } from "./channel";
import { conversations } from "./conversation";
import { messages } from "./message";

export const scheduledMessageStatusEnum = pgEnum("scheduled_message_status", [
  "pending",     // Waiting to send
  "processing",  // Currently being processed by worker
  "sent",        // Successfully sent
  "cancelled",   // User cancelled before send time
  "failed",      // Send failed after retries
]);

export const scheduledMessages = pgTable("scheduled_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  status: scheduledMessageStatusEnum("status").notNull().default("pending"),
  jobId: text("job_id"), // BullMQ job ID for management
  messageId: uuid("message_id") // Populated after sending
    .references(() => messages.id, { onDelete: "set null" }),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("scheduled_messages_author_status_idx").on(table.authorId, table.status),
  index("scheduled_messages_scheduled_for_idx").on(table.scheduledFor),
]);

export const scheduledMessagesRelations = relations(scheduledMessages, ({ one }) => ({
  author: one(users, {
    fields: [scheduledMessages.authorId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [scheduledMessages.channelId],
    references: [channels.id],
  }),
  conversation: one(conversations, {
    fields: [scheduledMessages.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [scheduledMessages.messageId],
    references: [messages.id],
  }),
}));

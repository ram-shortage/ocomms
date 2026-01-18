import { pgTable, uuid, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { messages } from "./message";
import { users } from "./auth";

export const threadParticipants = pgTable("thread_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("thread_participants_unique_idx").on(table.threadId, table.userId),
  index("thread_participants_user_idx").on(table.userId),
]);

export const threadParticipantsRelations = relations(threadParticipants, ({ one }) => ({
  thread: one(messages, {
    fields: [threadParticipants.threadId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [threadParticipants.userId],
    references: [users.id],
  }),
}));

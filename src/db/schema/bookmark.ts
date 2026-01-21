import { pgTable, text, timestamp, uuid, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { messages } from "./message";
import { fileAttachments } from "./file-attachment";

export const bookmarkTypeEnum = pgEnum("bookmark_type", ["message", "file"]);

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: bookmarkTypeEnum("type").notNull(),
  messageId: uuid("message_id")
    .references(() => messages.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .references(() => fileAttachments.id, { onDelete: "cascade" }),
  note: text("note"), // Optional user note for BOOK-01
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Prevent duplicate message bookmarks per user
  uniqueIndex("bookmarks_user_message_unique_idx").on(table.userId, table.messageId),
  // Prevent duplicate file bookmarks per user
  uniqueIndex("bookmarks_user_file_unique_idx").on(table.userId, table.fileId),
  // Index for efficient user lookup
  index("bookmarks_user_idx").on(table.userId),
  // Index for sorted list queries
  index("bookmarks_user_created_idx").on(table.userId, table.createdAt),
]);

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  message: one(messages, {
    fields: [bookmarks.messageId],
    references: [messages.id],
  }),
  file: one(fileAttachments, {
    fields: [bookmarks.fileId],
    references: [fileAttachments.id],
  }),
}));

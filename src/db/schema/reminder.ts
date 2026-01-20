import { pgTable, text, timestamp, uuid, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { messages } from "./message";

export const reminderStatusEnum = pgEnum("reminder_status", [
  "pending",    // Waiting to fire
  "fired",      // Reminder triggered, awaiting user action
  "snoozed",    // User snoozed, waiting for next fire
  "completed",  // User marked as complete
  "cancelled",  // User cancelled
]);

export const reminderPatternEnum = pgEnum("reminder_pattern", [
  "daily",
  "weekly",
]);

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  note: text("note"), // Optional user note
  remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
  status: reminderStatusEnum("status").notNull().default("pending"),
  recurringPattern: reminderPatternEnum("recurring_pattern"),
  jobId: text("job_id"), // BullMQ job ID
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("reminders_user_status_idx").on(table.userId, table.status),
  index("reminders_remind_at_idx").on(table.remindAt),
]);

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, {
    fields: [reminders.userId],
    references: [users.id],
  }),
  message: one(messages, {
    fields: [reminders.messageId],
    references: [messages.id],
  }),
}));

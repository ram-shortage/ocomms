import { pgTable, text, timestamp, uuid, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";

export const userStatuses = pgTable("user_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(), // One status per user
  emoji: text("emoji"), // Single emoji character for STAT-01
  text: text("text"), // Up to 100 chars for STAT-01
  expiresAt: timestamp("expires_at", { withTimezone: true }), // For STAT-03 auto-clear
  dndEnabled: boolean("dnd_enabled").notNull().default(false), // For STAT-06
  jobId: text("job_id"), // BullMQ job ID for expiration tracking
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Unique constraint on userId (enforced by .unique())
  uniqueIndex("user_statuses_user_unique_idx").on(table.userId),
  // Index on expiresAt for expiration queries
  index("user_statuses_expires_at_idx").on(table.expiresAt),
]);

export const userStatusesRelations = relations(userStatuses, ({ one }) => ({
  user: one(users, {
    fields: [userStatuses.userId],
    references: [users.id],
  }),
}));

import { pgTable, text, timestamp, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { channels } from "./channel";
import { users } from "./auth";

/**
 * Channel notification settings table.
 *
 * Stores per-user-per-channel notification preferences.
 * Pattern: No entry = "all" mode (default). Only store when user changes from default.
 *
 * Modes:
 * - "all": Receive all notifications (default behavior)
 * - "mentions": Only direct @mentions (not @channel/@here)
 * - "muted": No notifications at all
 */
export const channelNotificationSettings = pgTable("channel_notification_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("all"), // "all" | "mentions" | "muted"
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Unique constraint: one setting per user per channel
  uniqueIndex("channel_notification_settings_unique_idx").on(table.channelId, table.userId),
  // Index for fetching all user's settings efficiently
  index("channel_notification_settings_user_idx").on(table.userId),
]);

export const channelNotificationSettingsRelations = relations(channelNotificationSettings, ({ one }) => ({
  channel: one(channels, {
    fields: [channelNotificationSettings.channelId],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [channelNotificationSettings.userId],
    references: [users.id],
  }),
}));

// Type for notification mode
export type NotificationMode = "all" | "mentions" | "muted";

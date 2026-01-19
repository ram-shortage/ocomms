/**
 * Push subscription storage schema
 *
 * Stores browser push subscriptions per user.
 * A user may have multiple subscriptions (multiple devices/browsers).
 * The endpoint is unique - each browser/device has its own endpoint.
 *
 * Fields from PushSubscription.toJSON():
 * - endpoint: Push service URL (unique per browser)
 * - p256dh: Public key for encryption (~88 chars base64)
 * - auth: Authentication secret (~24 chars base64)
 */
import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint),
]);

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

import { pgTable, text, uuid, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users, members } from "./auth";
import { channels } from "./channel";

/**
 * Guest channel access - junction table for channel-scoped guest permissions
 * Guests can only access specific channels granted to them
 */
export const guestChannelAccess = pgTable("guest_channel_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("guest_channel_access_unique_idx").on(table.memberId, table.channelId),
  index("guest_channel_access_member_idx").on(table.memberId),
]);

/**
 * Guest invites - shareable link tokens for guest onboarding
 * Admin generates invite link that grants access to specific channels
 */
export const guestInvites = pgTable("guest_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // nanoid for shareable link
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at"),      // GUST-08: Optional expiration
  channelIds: text("channel_ids").notNull(), // JSON array of allowed channel IDs
  usedBy: text("used_by")
    .references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const guestChannelAccessRelations = relations(guestChannelAccess, ({ one }) => ({
  member: one(members, {
    fields: [guestChannelAccess.memberId],
    references: [members.id],
  }),
  channel: one(channels, {
    fields: [guestChannelAccess.channelId],
    references: [channels.id],
  }),
}));

export const guestInviteRelations = relations(guestInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [guestInvites.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [guestInvites.createdBy],
    references: [users.id],
    relationName: "guestInviteCreator",
  }),
  usedByUser: one(users, {
    fields: [guestInvites.usedBy],
    references: [users.id],
    relationName: "guestInviteUsedBy",
  }),
}));

import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { channels } from "./channel";
import { users, organizations } from "./auth";

/**
 * Channel notes - one collaborative note per channel.
 * Version column enables optimistic locking for conflict detection.
 */
export const channelNotes = pgTable("channel_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("channel_notes_channel_idx").on(table.channelId),
]);

/**
 * Personal notes - one private note per user per organization (workspace).
 * Version column enables optimistic locking for conflict detection.
 */
export const personalNotes = pgTable("personal_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("personal_notes_user_org_idx").on(table.userId, table.organizationId),
]);

export const channelNotesRelations = relations(channelNotes, ({ one }) => ({
  channel: one(channels, {
    fields: [channelNotes.channelId],
    references: [channels.id],
  }),
  updatedByUser: one(users, {
    fields: [channelNotes.updatedBy],
    references: [users.id],
  }),
}));

export const personalNotesRelations = relations(personalNotes, ({ one }) => ({
  user: one(users, {
    fields: [personalNotes.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [personalNotes.organizationId],
    references: [organizations.id],
  }),
}));

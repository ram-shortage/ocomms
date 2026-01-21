import { pgTable, text, uuid, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./auth";

/**
 * User groups for @mentionable handles
 * Groups are org-scoped with unique handles per workspace
 */
export const userGroups = pgTable("user_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),           // Display name: "Design Team"
  handle: text("handle").notNull(),       // @handle: "designers"
  description: text("description"),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // UGRP-05: Unique handle per workspace
  uniqueIndex("user_groups_org_handle_idx").on(table.organizationId, table.handle),
]);

/**
 * User group membership junction table
 */
export const userGroupMembers = pgTable("user_group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => userGroups.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_group_members_unique_idx").on(table.groupId, table.userId),
  index("user_group_members_user_idx").on(table.userId),
]);

// Relations
export const userGroupRelations = relations(userGroups, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [userGroups.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [userGroups.createdBy],
    references: [users.id],
  }),
  members: many(userGroupMembers),
}));

export const userGroupMemberRelations = relations(userGroupMembers, ({ one }) => ({
  group: one(userGroups, {
    fields: [userGroupMembers.groupId],
    references: [userGroups.id],
  }),
  user: one(users, {
    fields: [userGroupMembers.userId],
    references: [users.id],
  }),
}));

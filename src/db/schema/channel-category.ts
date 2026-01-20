import { pgTable, text, timestamp, uuid, uniqueIndex, integer, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./auth";
import { channels } from "./channel";

export const channelCategories = pgTable("channel_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("channel_categories_org_idx").on(table.organizationId),
]);

export const userCategoryCollapseStates = pgTable("user_category_collapse_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => channelCategories.id, { onDelete: "cascade" }),
  isCollapsed: boolean("is_collapsed").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_category_collapse_unique_idx").on(table.userId, table.categoryId),
]);

// Relations
export const channelCategoriesRelations = relations(channelCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [channelCategories.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [channelCategories.createdBy],
    references: [users.id],
  }),
  channels: many(channels),
}));

export const userCategoryCollapseStatesRelations = relations(userCategoryCollapseStates, ({ one }) => ({
  user: one(users, {
    fields: [userCategoryCollapseStates.userId],
    references: [users.id],
  }),
  category: one(channelCategories, {
    fields: [userCategoryCollapseStates.categoryId],
    references: [channelCategories.id],
  }),
}));

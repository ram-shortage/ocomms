import { pgTable, text, timestamp, uuid, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, organizations } from "./auth";

/**
 * User sidebar preferences stored as JSON for flexibility.
 * Each user has per-workspace preferences for ordering and visibility.
 */
export interface SidebarPreferencesData {
  categoryOrder: string[];      // Category IDs in user's preferred order
  dmOrder: string[];            // DM conversation IDs in order
  sectionOrder: string[];       // Section IDs: 'threads', 'search', 'notes', 'scheduled', 'reminders', 'saved'
  hiddenSections: string[];     // Section IDs user has hidden
  collapsedSections: string[];  // Section IDs user has collapsed (different from hidden)
  mainSectionOrder: string[];   // Main section IDs: 'channels', 'dms', 'archived' - order of main sections
  updatedAt: string;            // ISO timestamp for conflict resolution
}

export const DEFAULT_SECTION_ORDER = ['threads', 'search', 'notes', 'scheduled', 'reminders', 'saved'];
export const DEFAULT_MAIN_SECTION_ORDER = ['channels', 'dms', 'archived'];

export const userSidebarPreferences = pgTable("user_sidebar_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  preferences: jsonb("preferences").notNull().$type<SidebarPreferencesData>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_sidebar_preferences_user_org_idx").on(table.userId, table.organizationId),
]);

// Relations
export const userSidebarPreferencesRelations = relations(userSidebarPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userSidebarPreferences.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [userSidebarPreferences.organizationId],
    references: [organizations.id],
  }),
}));

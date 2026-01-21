import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./auth";

/**
 * Custom emoji table
 * Stores workspace-specific custom emoji (EMOJ-04)
 * Names must be unique within each workspace
 */
export const customEmojis = pgTable(
  "custom_emojis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(), // Emoji shortcode without colons
    filename: varchar("filename", { length: 255 }).notNull(), // UUID-based name on disk
    path: varchar("path", { length: 500 }).notNull(), // Public URL path /uploads/emoji/...
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    isAnimated: boolean("is_animated").notNull().default(false), // GIF flag (EMOJ-07)
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // EMOJ-04: Names must be unique within workspace
    uniqueIndex("custom_emojis_workspace_name_unique").on(table.workspaceId, table.name),
    // Index for fetching all workspace emoji
    index("custom_emojis_workspace_idx").on(table.workspaceId),
  ]
);

// Relations
export const customEmojisRelations = relations(customEmojis, ({ one }) => ({
  workspace: one(organizations, {
    fields: [customEmojis.workspaceId],
    references: [organizations.id],
  }),
  uploader: one(users, {
    fields: [customEmojis.uploadedBy],
    references: [users.id],
  }),
}));

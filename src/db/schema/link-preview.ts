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
import { messages } from "./message";

/**
 * Link preview cache table
 * Stores Open Graph/Twitter Card metadata for URLs
 * LINK-04: Caching for repeated URL references
 */
export const linkPreviews = pgTable(
  "link_previews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull().unique(), // Canonical URL for cache lookup
    title: varchar("title", { length: 500 }),
    description: text("description"),
    imageUrl: text("image_url"),
    siteName: varchar("site_name", { length: 200 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // 24-hour TTL
  },
  (table) => [
    index("link_previews_expires_idx").on(table.expiresAt),
  ]
);

/**
 * Junction table for message-to-preview relationship
 * LINK-02: Tracks position of preview in message (multiple URLs)
 * LINK-06: Hidden flag for user-dismissed previews
 */
export const messageLinkPreviews = pgTable(
  "message_link_previews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    linkPreviewId: uuid("link_preview_id")
      .notNull()
      .references(() => linkPreviews.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0), // Order in message (LINK-02)
    hidden: boolean("hidden").notNull().default(false), // User dismissed (LINK-06)
  },
  (table) => [
    index("message_link_previews_message_idx").on(table.messageId),
    uniqueIndex("message_link_previews_unique").on(table.messageId, table.linkPreviewId),
  ]
);

// Relations
export const linkPreviewsRelations = relations(linkPreviews, ({ many }) => ({
  messagePreviews: many(messageLinkPreviews),
}));

export const messageLinkPreviewsRelations = relations(messageLinkPreviews, ({ one }) => ({
  message: one(messages, {
    fields: [messageLinkPreviews.messageId],
    references: [messages.id],
  }),
  linkPreview: one(linkPreviews, {
    fields: [messageLinkPreviews.linkPreviewId],
    references: [linkPreviews.id],
  }),
}));

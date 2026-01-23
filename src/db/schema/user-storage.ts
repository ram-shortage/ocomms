import { pgTable, text, bigint, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";

export const userStorage = pgTable("user_storage", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  usedBytes: bigint("used_bytes", { mode: "number" }).notNull().default(0),
  quotaBytes: bigint("quota_bytes", { mode: "number" })
    .notNull()
    .default(1073741824), // 1GB
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userStorageRelations = relations(userStorage, ({ one }) => ({
  user: one(users, {
    fields: [userStorage.userId],
    references: [users.id],
  }),
}));

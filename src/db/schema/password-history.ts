import { pgTable, text, timestamp, varchar, index, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

/**
 * Password history tracking for preventing password reuse.
 *
 * Stores bcrypt hashes of the last N passwords for each user.
 * When a user changes their password, we check against this history
 * to prevent reusing recent passwords (SEC2-20).
 *
 * The default policy is to prevent reusing the last 5 passwords.
 */
export const passwordHistory = pgTable(
  "password_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("password_history_user_id_idx").on(table.userId),
    userIdCreatedAtIdx: index("password_history_user_id_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export const passwordHistoryRelations = relations(passwordHistory, ({ one }) => ({
  user: one(user, {
    fields: [passwordHistory.userId],
    references: [user.id],
  }),
}));

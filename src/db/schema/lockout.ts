import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { user } from "./auth";

// Account lockout tracking for authentication hardening
// Separate from users table since better-auth owns core schema
export const userLockout = pgTable("user_lockouts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lastFailedAt: timestamp("last_failed_at"),
  lockedUntil: timestamp("locked_until"),
  lockoutCount: integer("lockout_count").notNull().default(0), // For progressive escalation
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Backward-compatible plural alias
export const userLockouts = userLockout;

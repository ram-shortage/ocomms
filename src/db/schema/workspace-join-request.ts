import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users, organizations } from "./auth";
import { nanoid } from "nanoid";

/**
 * Workspace join requests - users request to join workspaces with "Request" join policy
 * Admins can approve/reject requests from workspace settings or inline notifications
 */
export const workspaceJoinRequests = pgTable(
  "workspace_join_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    message: text("message"), // Optional message from requester
    status: text("status").notNull().default("pending"), // pending, approved, rejected
    rejectionReason: text("rejection_reason"), // Optional reason sent to requester
    createdAt: timestamp("created_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"), // When admin took action
    reviewedBy: text("reviewed_by").references(() => users.id), // Admin who reviewed
  },
  (table) => [
    // Prevent duplicate pending requests from same user to same workspace
    uniqueIndex("workspace_join_request_unique_idx").on(
      table.userId,
      table.organizationId
    ),
  ]
);

// Relations
export const workspaceJoinRequestRelations = relations(
  workspaceJoinRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [workspaceJoinRequests.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [workspaceJoinRequests.organizationId],
      references: [organizations.id],
    }),
    reviewer: one(users, {
      fields: [workspaceJoinRequests.reviewedBy],
      references: [users.id],
      relationName: "joinRequestReviewer",
    }),
  })
);

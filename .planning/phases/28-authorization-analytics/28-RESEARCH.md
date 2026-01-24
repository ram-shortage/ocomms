# Phase 28: Authorization & Analytics - Research

**Researched:** 2026-01-21
**Domain:** User groups, guest accounts, workspace analytics
**Confidence:** HIGH

## Summary

Phase 28 adds three admin-focused features: user groups for @mentionable handles, guest accounts with restricted channel access and expiration, and a workspace analytics dashboard. The codebase already has strong patterns for admin functionality (role-based access in `members` table), mention parsing (`src/lib/mentions.ts`), expiration jobs (BullMQ workers), and data export (existing export route pattern).

The primary technical challenges are:
1. **User Groups**: Extending the mention system to support group handles alongside user mentions, with tabbed autocomplete UI
2. **Guest Accounts**: Adding a new membership role/type with channel-scoped access restrictions and BullMQ-powered expiration
3. **Analytics**: Efficient aggregate queries in Drizzle ORM with time-based grouping, plus chart visualization

**Primary recommendation:** Follow existing codebase patterns (Drizzle schema, BullMQ jobs, shadcn/ui components) and add the shadcn chart component which uses Recharts under the hood.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.x | Database queries & aggregations | Already in use, supports groupBy/count |
| bullmq | 5.66.x | Guest expiration jobs | Already in use for scheduled-message, reminder, status-expiration |
| recharts | (via shadcn) | Chart rendering | Recommended by shadcn/ui, production-ready |
| date-fns | 4.1.x | Date formatting & manipulation | Already in use throughout codebase |
| nanoid | 5.1.x | Guest invite link tokens | Already in use for ID generation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui chart | latest | Chart components | Install via `npx shadcn@latest add chart` |
| shadcn/ui tabs | latest | Analytics tab navigation | Install via `npx shadcn@latest add tabs` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts (via shadcn) | Tremor | Tremor is simpler but less flexible; shadcn integrates better with existing UI |
| Client-side CSV | Server-side CSV | Server-side adds load; client-side with Blob works well for reasonable datasets |

**Installation:**
```bash
npx shadcn@latest add chart
npx shadcn@latest add tabs
```

## Architecture Patterns

### Recommended Project Structure for New Features
```
src/
├── db/schema/
│   ├── user-group.ts          # UserGroup & UserGroupMember tables
│   └── guest-invite.ts        # GuestInvite table for shareable links
├── lib/actions/
│   ├── user-group.ts          # Server actions for group CRUD
│   ├── guest.ts               # Server actions for guest management
│   └── analytics.ts           # Server actions for analytics queries
├── workers/
│   └── guest-expiration.worker.ts  # Handle guest soft-lock
├── server/queue/
│   └── guest-expiration.queue.ts   # BullMQ queue definition
├── app/(workspace)/[workspaceSlug]/settings/
│   ├── user-groups/page.tsx   # User groups management
│   ├── guests/page.tsx        # Guest management
│   └── analytics/page.tsx     # Analytics dashboard
└── components/
    ├── user-group/            # Group-related components
    ├── guest/                 # Guest badge, invite components
    └── analytics/             # Chart components, tabs
```

### Pattern 1: User Groups Schema
**What:** Two tables - userGroups (group metadata) and userGroupMembers (membership junction)
**When to use:** Any @mentionable group with unique handles per workspace
**Example:**
```typescript
// Source: Following existing channelMembers pattern
import { pgTable, text, uuid, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./auth";

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
```

### Pattern 2: Guest Account Model
**What:** Extend members table with role="guest" and add guestChannelAccess junction + guestInvites for links
**When to use:** Channel-scoped external access with expiration
**Example:**
```typescript
// Source: Extending existing members pattern
// Option A: New role in members table + channel access junction

export const guestChannelAccess = pgTable("guest_channel_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("guest_channel_access_unique_idx").on(table.memberId, table.channelId),
]);

export const guestInvites = pgTable("guest_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), // nanoid for shareable link
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at"),      // GUST-08: Optional expiration
  channelIds: text("channel_ids").notNull(), // JSON array of allowed channel IDs
  usedBy: text("used_by")
    .references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Add to members table in migration:
// - Add "guest" to role enum or add isGuest boolean
// - Add guestExpiresAt timestamp
// - Add guestSoftLocked boolean
// - Add guestJobId text (for BullMQ expiration job)
```

### Pattern 3: Analytics Aggregate Queries
**What:** Drizzle SQL for time-grouped aggregations
**When to use:** Message counts, active users, channel activity
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/select + Drizzle discussions
import { sql, count, eq, and, gte, lte } from "drizzle-orm";
import { messages, users, members } from "@/db/schema";

// Message volume by day
const messagesByDay = await db
  .select({
    date: sql<string>`DATE(${messages.createdAt})`.mapWith(String),
    count: count(),
  })
  .from(messages)
  .where(
    and(
      eq(messages.channelId, channelId),
      gte(messages.createdAt, startDate),
      lte(messages.createdAt, endDate)
    )
  )
  .groupBy(sql`DATE(${messages.createdAt})`)
  .orderBy(sql`DATE(${messages.createdAt})`);

// Active users count (distinct authors in period)
const activeUsers = await db
  .select({
    count: sql<number>`cast(count(DISTINCT ${messages.authorId}) as integer)`,
  })
  .from(messages)
  .where(
    and(
      gte(messages.createdAt, startDate),
      lte(messages.createdAt, endDate)
    )
  );

// Channel activity ranking (top 10)
const channelActivity = await db
  .select({
    channelId: messages.channelId,
    messageCount: count(),
  })
  .from(messages)
  .where(
    and(
      gte(messages.createdAt, startDate),
      lte(messages.createdAt, endDate)
    )
  )
  .groupBy(messages.channelId)
  .orderBy(sql`count(*) DESC`)
  .limit(10);
```

### Pattern 4: Chart Component Usage
**What:** shadcn/ui chart with Recharts composition
**When to use:** Analytics visualization
**Example:**
```typescript
// Source: https://ui.shadcn.com/docs/components/chart
import { ChartContainer, ChartConfig } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const chartConfig = {
  messages: {
    label: "Messages",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function MessageVolumeChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="count"
          stroke="var(--color-messages)"
          strokeWidth={2}
        />
      </LineChart>
    </ChartContainer>
  );
}
```

### Pattern 5: CSV Export (Client-side)
**What:** Generate CSV in browser using Blob and trigger download
**When to use:** Analytics export with user-selected granularity
**Example:**
```typescript
// Source: Standard browser API pattern
function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        // Escape commas and quotes
        const str = String(val ?? "");
        return str.includes(",") || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    ),
  ];

  const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM for Excel UTF-8
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
```

### Anti-Patterns to Avoid
- **Putting guest logic in users table:** Use members table extension, not users - guests are workspace-scoped
- **Real-time analytics:** Context says manual refresh only - don't add auto-polling
- **Group mentions without channel intersection:** UGRP-06 requires only notifying members who are in the channel
- **Storing analytics data separately:** Query live data with efficient aggregations, don't duplicate

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG/Canvas charts | shadcn/ui chart (Recharts) | Responsive, accessible, styled |
| Date grouping in SQL | Loop through dates in JS | PostgreSQL DATE() in Drizzle sql`` | DB-level aggregation is faster |
| BullMQ job management | Custom scheduler | Existing queue pattern | Already proven in 3 workers |
| Role-based access | Custom middleware | Existing admin check pattern | Consistent with channel/category code |
| Mention parsing | New parser for groups | Extend existing parseMentions | Keep mention logic unified |

**Key insight:** The codebase has established patterns for nearly every aspect of this phase - follow them rather than inventing new approaches.

## Common Pitfalls

### Pitfall 1: Group Mention Notification Spam
**What goes wrong:** Notifying all group members regardless of channel membership
**Why it happens:** Easy to just iterate group members without checking channel
**How to avoid:** UGRP-06 requires intersection: `groupMembers INTERSECT channelMembers`
**Warning signs:** Notifications going to users who can't see the channel

### Pitfall 2: Guest Expiration Race Condition
**What goes wrong:** Old job soft-locks guest after admin extended expiration
**Why it happens:** BullMQ job scheduled, then admin extends, but job still fires
**How to avoid:** Store jobId on member record, verify jobId matches in worker (like status-expiration.worker.ts)
**Warning signs:** Guests getting locked despite valid expiration dates

### Pitfall 3: Analytics Query Performance
**What goes wrong:** Full table scans on messages table for date ranges
**Why it happens:** Missing indexes on createdAt or not limiting scope
**How to avoid:** Use existing indexes, always scope to organization, consider reasonable limits
**Warning signs:** Slow analytics page load, database timeouts

### Pitfall 4: Guest Channel Access Bypass
**What goes wrong:** Guest accesses channel they shouldn't via direct URL
**Why it happens:** Missing authorization check in channel page/handlers
**How to avoid:** Add guest access check alongside existing membership checks
**Warning signs:** Security audit finds unauthorized access paths

### Pitfall 5: CSV Export Memory Issues
**What goes wrong:** Browser crashes on large exports
**Why it happens:** Loading entire dataset into memory at once
**How to avoid:** Reasonable time range limits, warn for large exports, consider pagination
**Warning signs:** Export fails for workspaces with high message volume

## Code Examples

Verified patterns from existing codebase:

### Admin Role Check (Existing Pattern)
```typescript
// Source: src/lib/actions/admin.ts
const callerMembership = await db.query.members.findFirst({
  where: and(
    eq(members.userId, session.user.id),
    eq(members.organizationId, organizationId)
  ),
});

if (!callerMembership || (callerMembership.role !== "owner" && callerMembership.role !== "admin")) {
  throw new Error("Only admins can perform this action");
}
```

### BullMQ Queue Pattern (Existing Pattern)
```typescript
// Source: src/server/queue/status-expiration.queue.ts
import { Queue } from "bullmq";
import { getQueueConnection } from "./connection";

export interface GuestExpirationJobData {
  memberId: string;
}

export const guestExpirationQueue = new Queue<GuestExpirationJobData>(
  "guest-expiration",
  {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  }
);
```

### Extend Mention Parsing for Groups
```typescript
// Source: Extending src/lib/mentions.ts
export interface ParsedMention {
  type: "user" | "channel" | "here" | "group"; // Add "group"
  value: string;
  start: number;
  end: number;
  raw: string;
}

// Groups use same @handle syntax as users - distinguish by lookup
// When parsing: check if value matches a group handle in workspace
// If yes: type = "group", if no: type = "user"
```

### Tabbed Autocomplete Pattern (New)
```typescript
// Source: Extending existing mention-autocomplete.tsx
// Add tabs array
const [activeTab, setActiveTab] = useState<"users" | "groups">("users");

// In render, add tab headers
<div className="flex border-b">
  <button
    className={cn("px-3 py-1", activeTab === "users" && "border-b-2 border-primary")}
    onClick={() => setActiveTab("users")}
  >
    Users
  </button>
  <button
    className={cn("px-3 py-1", activeTab === "groups" && "border-b-2 border-primary")}
    onClick={() => setActiveTab("groups")}
  >
    Groups
  </button>
</div>
// Then show filteredMembers or filteredGroups based on activeTab
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js | Recharts via shadcn | 2024 | Better React integration, composition-based |
| Server-side CSV generation | Client-side Blob | 2023 | Reduces server load, instant UX |
| Separate analytics tables | Query aggregations | Current | Simpler data model, always fresh |

**Deprecated/outdated:**
- Prisma: Codebase uses Drizzle ORM exclusively
- Custom chart libraries: shadcn chart is the standard for shadcn-based projects

## Open Questions

Things that couldn't be fully resolved:

1. **Group mention in thread replies**
   - What we know: Groups work in channels
   - What's unclear: Should group mentions in thread replies also respect channel membership?
   - Recommendation: Yes, apply same UGRP-06 rule

2. **Guest DM initiation from members**
   - What we know: Guests cannot initiate DMs, members can DM guests
   - What's unclear: What UI allows members to start DM with guest?
   - Recommendation: Same "Start DM" flow, guest appears in member list of their channels

3. **Analytics data retention**
   - What we know: Query live data, no separate analytics tables
   - What's unclear: Will queries be fast enough for workspaces with millions of messages?
   - Recommendation: Add reasonable date range limits (max 1 year), test with realistic data

## Sources

### Primary (HIGH confidence)
- Codebase: `src/db/schema/*.ts` - Existing schema patterns
- Codebase: `src/lib/mentions.ts` - Mention parsing implementation
- Codebase: `src/workers/*.ts` - BullMQ worker patterns
- Codebase: `src/lib/actions/admin.ts` - Admin authorization patterns
- [shadcn/ui Chart Component](https://ui.shadcn.com/docs/components/chart) - Installation and usage
- [Drizzle ORM Select](https://orm.drizzle.team/docs/select) - groupBy and aggregations

### Secondary (MEDIUM confidence)
- [Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) - Library comparison
- [Drizzle date grouping discussion](https://github.com/drizzle-team/drizzle-orm/discussions/2893) - TO_CHAR patterns

### Tertiary (LOW confidence)
- General web search on CSV export patterns - Verified with browser API docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use or official shadcn
- Architecture: HIGH - Following existing codebase patterns
- Pitfalls: MEDIUM - Based on experience with similar features
- Analytics queries: MEDIUM - Drizzle patterns verified, performance needs testing

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable patterns)

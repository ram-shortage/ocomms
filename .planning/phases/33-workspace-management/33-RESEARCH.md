# Phase 33: Workspace Management - Research

**Researched:** 2026-01-22
**Domain:** Multi-workspace UI, workspace discovery, join request flows, multi-tenancy state management
**Confidence:** HIGH

## Summary

Workspace management requires a multi-component system: a dropdown switcher with preview cards showing workspace state (unread counts, member counts, activity), a discovery/browse interface for joining new workspaces, an approval flow for join requests with dual-channel notifications (email + in-app), and state management for preserving user context when switching between workspaces.

The project already uses better-auth's organization plugin for workspace (organization) data and membership, Radix UI for dropdown components, Socket.IO for real-time updates, and follows Next.js App Router patterns with path-based multi-tenancy (`/[workspaceSlug]/...`). The architecture decision to use path-based routing over subdomains is locked in via existing URL structure.

Unread count calculation should aggregate at the workspace level (sum of channel + DM unreads per workspace), requiring efficient SQL queries with proper indexing. Real-time updates should only subscribe to the active workspace's Socket.IO room, with other workspaces refreshing on switch to avoid connection overhead. Last-visited position restoration can use Redis with a simple key structure: `user:{userId}:workspace:{workspaceId}:last-visited` storing the full path.

**Primary recommendation:** Build workspace switcher as Radix DropdownMenu with card-based items, use better-auth's existing organization APIs for membership queries, implement workspace-scoped unread aggregation via SQL window functions, and store last-visited paths in Redis with 30-day TTL.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dropdown-menu | 2.1.16 | Workspace switcher dropdown | Already used in project, accessible, composable |
| better-auth organization plugin | 1.4.14 | Workspace membership & invitations | Already integrated, handles org/member CRUD |
| Next.js App Router | 16.1.3 | Path-based multi-tenancy routing | Project standard, supports dynamic routes |
| Socket.IO rooms | 4.8.3 | Per-workspace real-time isolation | Already used, supports namespace/room pattern |
| Redis (ioredis) | 5.9.2 | Last-visited state storage | Already used for sessions/cache |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Drizzle ORM | 0.45.1 | Workspace unread count queries | Existing DB layer, needed for aggregations |
| Tailwind CSS | 4.x | Workspace card styling | Project standard for UI |
| date-fns | 4.1.0 | Last activity timestamp formatting | Already used for dates |
| Lucide React | 0.562.0 | Icons for workspace cards | Project icon library |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Redis for last-visited | PostgreSQL user_preferences table | Redis faster for ephemeral state, no DB schema needed |
| Path-based routing | Subdomain routing | Path-based simpler, no DNS config, already implemented |
| Card-style dropdown | Compact list dropdown | Cards show more info at a glance (requirement from CONTEXT.md) |

**Installation:**
No new packages required - all dependencies already in project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── workspace/
│       ├── workspace-switcher.tsx           # Main dropdown component
│       ├── workspace-card.tsx               # Individual workspace preview card
│       ├── workspace-browse.tsx             # Discovery/browse page component
│       └── workspace-join-request-list.tsx  # Admin approval interface
├── app/
│   ├── browse-workspaces/
│   │   └── page.tsx                         # Browse page route
│   └── (workspace)/[workspaceSlug]/
│       └── settings/
│           └── join-requests/
│               └── page.tsx                 # Admin join request management
├── lib/
│   ├── actions/
│   │   └── workspace.ts                     # Server actions for join/approve
│   └── hooks/
│       └── use-workspace-unread.ts          # Unread count hook per workspace
└── server/
    └── socket/
        └── handlers/
            └── workspace-unread.ts          # Socket handler for unread events
```

### Pattern 1: Workspace Switcher with Preview Cards
**What:** Dropdown menu triggered from header showing list of workspaces as cards with metadata (name, unread count, member count, last activity).

**When to use:** Primary navigation between workspaces user belongs to.

**Example:**
```typescript
// Source: Radix UI Dropdown Menu docs + project CONTEXT.md requirements
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function WorkspaceSwitcher({ currentWorkspace, workspaces }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2">
          <WorkspaceIcon src={currentWorkspace.logo} />
          <span>{currentWorkspace.name}</span>
          <ChevronDown />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {workspaces.map(ws => (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            unreadCount={unreadCounts[ws.id] || 0}
            memberCount={ws.memberCount}
            lastActivity={ws.lastActivityAt}
          />
        ))}
        <DropdownMenuItem asChild>
          <Link href="/browse-workspaces">Browse workspaces</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Pattern 2: Workspace-Scoped Unread Aggregation
**What:** Calculate total unread messages per workspace by summing channel and conversation unread counts.

**When to use:** Displaying unread badge in workspace switcher.

**Example:**
```typescript
// Source: Existing use-unread.ts hook pattern + SQL aggregation best practices
// SQL query pattern for workspace unread counts
const query = db
  .select({
    workspaceId: channels.organizationId,
    totalUnread: sql<number>`
      COALESCE(SUM(${channelReadState.unreadCount}), 0) +
      COALESCE(
        (SELECT SUM(unread_count)
         FROM conversation_read_states crs
         JOIN conversations c ON c.id = crs.conversation_id
         WHERE c.organization_id = ${channels.organizationId}
           AND crs.user_id = ${userId}
        ), 0
      )
    `.as('total_unread')
  })
  .from(channels)
  .leftJoin(channelReadState,
    and(
      eq(channelReadState.channelId, channels.id),
      eq(channelReadState.userId, userId)
    )
  )
  .groupBy(channels.organizationId);
```

### Pattern 3: Last-Visited Position Restoration
**What:** Store last channel/page URL per workspace per user in Redis, restore on workspace switch.

**When to use:** Improving UX by returning user to where they left off in each workspace.

**Example:**
```typescript
// Source: Redis session store patterns + project Redis usage
import { redis } from "@/lib/redis";

// Store last visited
async function storeLastVisited(userId: string, workspaceId: string, path: string) {
  const key = `user:${userId}:workspace:${workspaceId}:last-visited`;
  await redis.set(key, path, "EX", 60 * 60 * 24 * 30); // 30 day TTL
}

// Retrieve and redirect
async function getLastVisitedPath(userId: string, workspaceId: string): Promise<string | null> {
  const key = `user:${userId}:workspace:${workspaceId}:last-visited`;
  return await redis.get(key);
}

// Usage in layout or middleware
const lastPath = await getLastVisitedPath(userId, workspaceId);
if (lastPath) {
  redirect(lastPath);
} else {
  redirect(`/${workspaceSlug}`); // Default workspace home
}
```

### Pattern 4: Join Request Approval Flow
**What:** User submits join request → creates pending record → sends notification to workspace owners → owner approves/rejects → notification sent back to requester.

**When to use:** Workspaces with "Request" join policy (requires approval).

**Example:**
```typescript
// Source: Better-auth invitation pattern + approval flow research
// Database schema (add to existing)
export const workspaceJoinRequests = pgTable("workspace_join_requests", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  userId: text("user_id").notNull().references(() => user.id),
  organizationId: text("organization_id").notNull().references(() => organization.id),
  message: text("message"), // Optional message from requester
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  rejectionReason: text("rejection_reason"), // Optional reason if rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by").references(() => user.id),
});

// Server action pattern
export async function submitJoinRequest(workspaceId: string, message?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Create request
  const request = await db.insert(workspaceJoinRequests).values({
    userId: session.user.id,
    organizationId: workspaceId,
    message,
  }).returning();

  // Send notifications (email + in-app)
  await notifyWorkspaceOwners(workspaceId, request[0]);

  return { success: true };
}
```

### Pattern 5: Socket.IO Room-Based Real-Time per Workspace
**What:** Only subscribe to Socket.IO rooms for active workspace, unsubscribe when switching.

**When to use:** Minimizing connection overhead and server load for multi-workspace users.

**Example:**
```typescript
// Source: Socket.IO rooms documentation + existing project patterns
// Client-side workspace room management
useEffect(() => {
  const socket = getSocket();

  // Join workspace room
  socket.emit("workspace:join", { workspaceId: currentWorkspace.id });

  // Listen for workspace-scoped events
  socket.on("workspace:unread-update", handleUnreadUpdate);

  return () => {
    // Leave workspace room on unmount/switch
    socket.emit("workspace:leave", { workspaceId: currentWorkspace.id });
    socket.off("workspace:unread-update", handleUnreadUpdate);
  };
}, [currentWorkspace.id]);

// Server-side room handling
socket.on("workspace:join", async ({ workspaceId }) => {
  // Verify user is member
  const isMember = await verifyWorkspaceMembership(socket.data.userId, workspaceId);
  if (!isMember) return;

  // Join room
  socket.join(`workspace:${workspaceId}`);
});
```

### Anti-Patterns to Avoid
- **Aggregate unread badge across all workspaces:** Per CONTEXT.md, only show per-workspace counts in switcher dropdown, no global aggregate.
- **Real-time subscriptions to all workspaces:** Only active workspace should receive Socket.IO updates; others refresh on switch.
- **Storing workspace state in localStorage:** Use Redis for server-side last-visited state; localStorage not accessible from server components.
- **Custom domain routing for workspaces:** Project uses path-based routing (`/[workspaceSlug]/...`); don't introduce subdomain complexity.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Organization membership management | Custom workspace/member tables | better-auth organization plugin | Handles org CRUD, invitations, role management with audit trail |
| Dropdown menu accessibility | Custom dropdown with onClick | Radix UI DropdownMenu | WAI-ARIA compliant, keyboard navigation, focus management |
| Real-time workspace isolation | Custom message filtering logic | Socket.IO rooms | Built-in pub/sub with room-based broadcasting |
| Last-visited state expiry | Custom TTL cleanup job | Redis SET with EX flag | Automatic expiration, no cleanup needed |
| Email + in-app notifications | Duplicate notification logic | Unified notification service | Single source of truth, prevents drift between channels |

**Key insight:** Multi-workspace systems have hidden complexity in membership verification, real-time isolation, and state synchronization. Use battle-tested libraries (better-auth for membership, Socket.IO rooms for isolation) rather than custom implementations.

## Common Pitfalls

### Pitfall 1: N+1 Queries for Unread Counts
**What goes wrong:** Fetching unread count per workspace with separate queries causes performance issues at scale.

**Why it happens:** Natural to loop through workspaces and query unread count individually, but this creates N queries for N workspaces.

**How to avoid:** Use SQL aggregation with JOINs and window functions to calculate all workspace unread counts in a single query. Group by workspace ID and sum channel + conversation unreads.

**Warning signs:** Slow workspace switcher load time, database query logs showing repeated similar queries with different workspace IDs.

### Pitfall 2: Forgetting to Unsubscribe from Socket.IO Rooms
**What goes wrong:** User switches workspace but still receives real-time updates from previous workspace, causing state corruption or incorrect unread counts.

**Why it happens:** Easy to implement "join room" logic but forget the cleanup in useEffect return function.

**How to avoid:** Always pair `socket.emit("workspace:join")` with `socket.emit("workspace:leave")` in the cleanup function. Test by switching workspaces rapidly and verifying message events only fire for active workspace.

**Warning signs:** Unread counts incrementing for wrong workspace, duplicate notifications, memory leaks from accumulated event listeners.

### Pitfall 3: Race Conditions in Last-Visited State
**What goes wrong:** User opens workspace in two tabs, switches in Tab A, then Tab B overwrites with stale path.

**Why it happens:** Redis SET operations aren't atomic with respect to external reads; last write wins without version checking.

**How to avoid:** Accept eventual consistency for last-visited state (minor UX impact), or implement optimistic locking with timestamps if precision critical. Document that last-visited is "best effort" restoration.

**Warning signs:** Users report being redirected to wrong channel after switching workspaces, especially when using multiple tabs.

### Pitfall 4: Authorization Bypass in Browse/Join Flow
**What goes wrong:** User can join invite-only workspaces by directly calling join API, bypassing visibility check.

**Why it happens:** Browse page filters invite-only workspaces from UI, but API endpoint doesn't verify join policy.

**How to avoid:** Server-side validation MUST check workspace join policy before creating join request or adding member. Never trust client-side filtering.

**Warning signs:** Unauthorized users appearing in private workspaces, security audit findings, user reports of seeing workspaces they shouldn't access.

### Pitfall 5: Notification Fatigue from Every Join Request
**What goes wrong:** Workspace owners flooded with notifications for every join request, especially in popular workspaces.

**Why it happens:** Individual notification per request seems logical, but doesn't scale to high-traffic scenarios.

**How to avoid:** Batch join request notifications (e.g., daily digest) or implement in-app badge with count instead of individual push notifications. Email for first request, then daily summary for additional requests.

**Warning signs:** Owner complaints about too many emails, notification opt-out requests, delayed approval times due to notification overload.

## Code Examples

Verified patterns from official sources and project conventions:

### Workspace Unread Count Hook
```typescript
// Source: Existing use-unread.ts pattern + workspace-scoped adaptation
"use client";

import { useState, useEffect } from "react";
import { useSocket } from "@/lib/socket-client";

interface WorkspaceUnreadCounts {
  [workspaceId: string]: number;
}

export function useWorkspaceUnreadCounts(workspaceIds: string[]) {
  const socket = useSocket();
  const [counts, setCounts] = useState<WorkspaceUnreadCounts>({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial counts
  useEffect(() => {
    if (workspaceIds.length === 0) {
      setIsLoading(false);
      return;
    }

    socket.emit("workspace:fetchUnreads", { workspaceIds }, (response) => {
      setCounts(response.counts);
      setIsLoading(false);
    });
  }, [socket, workspaceIds]);

  // Subscribe to real-time updates
  useEffect(() => {
    function handleUpdate(data: { workspaceId: string; unreadCount: number }) {
      if (workspaceIds.includes(data.workspaceId)) {
        setCounts(prev => ({ ...prev, [data.workspaceId]: data.unreadCount }));
      }
    }

    socket.on("workspace:unreadUpdate", handleUpdate);
    return () => socket.off("workspace:unreadUpdate", handleUpdate);
  }, [socket, workspaceIds]);

  return { counts, isLoading };
}
```

### Server Action for Join Request Approval
```typescript
// Source: Better-auth patterns + project server action conventions
"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { workspaceJoinRequests, members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "@/lib/email";

export async function approveJoinRequest(requestId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get request with workspace info
  const request = await db.query.workspaceJoinRequests.findFirst({
    where: eq(workspaceJoinRequests.id, requestId),
    with: { organization: true, user: true },
  });

  if (!request) throw new Error("Request not found");

  // Verify session user is workspace owner/admin
  const membership = await auth.api.getOrganizationMembership({
    headers: await headers(),
    query: {
      organizationId: request.organizationId,
      userId: session.user.id
    },
  });

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw new Error("Forbidden: Only owners/admins can approve requests");
  }

  // Update request status
  await db
    .update(workspaceJoinRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: session.user.id,
    })
    .where(eq(workspaceJoinRequests.id, requestId));

  // Add user to workspace via better-auth
  await auth.api.addMember({
    headers: await headers(),
    body: {
      organizationId: request.organizationId,
      userId: request.userId,
      role: "member",
    },
  });

  // Send approval notification (email + in-app)
  await sendEmail({
    to: request.user.email,
    subject: `You've been added to ${request.organization.name}`,
    text: `Your request to join ${request.organization.name} has been approved.`,
  });

  // Create in-app notification via Socket.IO
  const { io } = await import("@/server/socket");
  io.to(`user:${request.userId}`).emit("notification:new", {
    type: "workspace_join_approved",
    workspaceId: request.organizationId,
    workspaceName: request.organization.name,
  });

  return { success: true };
}

export async function rejectJoinRequest(requestId: string, reason?: string) {
  // Similar pattern with rejection logic + optional reason notification
  // ... implementation follows same auth/validation pattern
}
```

### Workspace Switcher Component
```typescript
// Source: Radix UI DropdownMenu + project UI component patterns
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Users, MessageCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceUnreadCounts } from "@/lib/hooks/use-workspace-unread";
import { formatDistanceToNow } from "date-fns";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  memberCount: number;
  lastActivityAt: Date | null;
}

export function WorkspaceSwitcher({
  currentWorkspace,
  workspaces
}: {
  currentWorkspace: Workspace;
  workspaces: Workspace[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { counts, isLoading } = useWorkspaceUnreadCounts(
    workspaces.map(ws => ws.id)
  );

  const handleWorkspaceSwitch = async (workspace: Workspace) => {
    setOpen(false);
    // Store intention to visit (for last-visited tracking)
    await fetch("/api/workspace/visit", {
      method: "POST",
      body: JSON.stringify({ workspaceId: workspace.id }),
    });
    router.push(`/${workspace.slug}`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors">
          {currentWorkspace.logo && (
            <img
              src={currentWorkspace.logo}
              alt=""
              className="w-6 h-6 rounded"
            />
          )}
          <span className="font-semibold">{currentWorkspace.name}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
          Your Workspaces
        </div>
        {workspaces.map(workspace => {
          const unreadCount = counts[workspace.id] || 0;
          const isActive = workspace.id === currentWorkspace.id;

          return (
            <DropdownMenuItem
              key={workspace.id}
              className="p-3 cursor-pointer"
              onSelect={() => handleWorkspaceSwitch(workspace)}
            >
              <div className="flex gap-3 items-start w-full">
                {workspace.logo && (
                  <img
                    src={workspace.logo}
                    alt=""
                    className="w-10 h-10 rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">
                      {workspace.name}
                    </span>
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="shrink-0">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {workspace.memberCount}
                    </span>
                    {workspace.lastActivityAt && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {formatDistanceToNow(workspace.lastActivityAt, {
                          addSuffix: true
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/browse-workspaces" className="w-full">
            Browse workspaces
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Subdomain-based multi-tenancy | Path-based with dynamic routes | Next.js 13 App Router | Simpler deployment, no DNS config, better SEO |
| Polling for unread counts | Socket.IO event-driven updates | Real-time messaging phase | Instant updates, reduced server load |
| localStorage for last-visited | Redis with TTL | Server Components era | Accessible from server, automatic cleanup |
| Custom dropdown accessibility | Radix Primitives | ~2023 | WAI-ARIA compliant, keyboard navigation built-in |
| Separate email/in-app notifications | Unified notification service | Modern patterns | Single source of truth, consistent delivery |

**Deprecated/outdated:**
- **Context API for workspace state:** Use server components + database queries; workspace list rarely changes, no need for client state management
- **Custom organization tables:** better-auth organization plugin handles this with proper audit trail and invitation system
- **Global unread badge:** Modern patterns (Slack, Discord) show per-workspace counts in switcher only, avoiding notification fatigue

## Open Questions

1. **Workspace member count caching strategy**
   - What we know: Member count displayed in workspace cards, changes infrequently
   - What's unclear: Should we cache in Redis with invalidation on member add/remove, or calculate on-demand with SQL COUNT? Trade-off: caching adds complexity but reduces DB load
   - Recommendation: Start with on-demand COUNT queries with proper indexing; add caching if performance profiling shows it's needed (YAGNI principle)

2. **Bulk approval UX implementation**
   - What we know: CONTEXT.md specifies checkboxes for bulk actions (approve/reject multiple at once)
   - What's unclear: Should bulk operations be atomic (all-or-nothing) or partial success with error reporting?
   - Recommendation: Partial success with detailed error reporting per request; atomic approach fails entire batch if one request has issues (e.g., user already member), poor UX

3. **Join request expiration policy**
   - What we know: Standard practice is 7-day expiration (Slack pattern)
   - What's unclear: Should expired requests auto-reject or stay pending indefinitely?
   - Recommendation: Implement 7-day expiration with auto-rejection and notification to requester; prevents stale request buildup, matches user expectations from Slack/Discord

## Sources

### Primary (HIGH confidence)
- Radix UI Dropdown Menu Documentation - https://www.radix-ui.com/primitives/docs/components/dropdown-menu - Component API, accessibility features, composition patterns
- Better Auth Organization Plugin - https://www.better-auth.com/docs/plugins/organization - Organization/membership API, invitation patterns
- Next.js Multi-tenant Guide - https://nextjs.org/docs/app/guides/multi-tenant - Path-based routing patterns, middleware usage
- Socket.IO Rooms Documentation - https://socket.io/docs/v3/rooms/ - Room-based broadcasting, isolation patterns
- Project codebase analysis - /src/lib/hooks/use-unread.ts, /src/components/notification/notification-bell.tsx - Existing patterns for unread counts and real-time updates

### Secondary (MEDIUM confidence)
- Building Multi-Panel Interfaces in Next.js - https://medium.com/@ruhi.chandra14/building-multi-panel-interfaces-in-next-js-using-a-workspace-based-architecture-4209aefff972 - Workspace architecture patterns, URL-based deep linking
- Multi-Tenant Architecture Guide - https://medium.com/@itsamanyadav/multi-tenant-architecture-in-next-js-a-complete-guide-25590c052de0 - Tenant isolation strategies, database patterns
- Redis Session Store Patterns - https://redis.io/blog/session-store-patterns/ - Last-visited state storage patterns
- Managing Invite Requests (Slack) - https://docs.slack.dev/admins/managing-invite-requests/ - Industry standard for join request flows

### Tertiary (LOW confidence)
- WebSearch results on workspace approval flows - General patterns for multi-stage approvals, notification strategies
- DEV Community Socket.IO rooms article - https://dev.to/ctrix/mastering-real-time-communication-with-socketio-rooms-4bom - Real-time isolation patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, verified versions, official documentation
- Architecture: HIGH - Patterns derived from existing codebase + official framework docs + user decisions in CONTEXT.md
- Pitfalls: MEDIUM - Based on general multi-workspace system experience + web search for common issues, not all verified in this specific stack

**Research date:** 2026-01-22
**Valid until:** ~2026-02-22 (30 days for stable web technologies; Next.js/React patterns unlikely to change rapidly)

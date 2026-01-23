---
phase: 33
plan: 02
subsystem: workspace-management
tags: [ui, workspace-switcher, real-time, redis, socket-io]
requires: [33-01]
provides: [workspace-switcher-ui, last-visited-restoration]
affects: [33-03]
tech-stack:
  added: []
  patterns: [workspace-switcher-dropdown, last-visited-redis-cache, workspace-unread-realtime]
key-files:
  created:
    - src/components/workspace/workspace-card.tsx
    - src/components/workspace/workspace-switcher.tsx
    - src/app/api/workspace/last-visited/route.ts
  modified:
    - src/components/workspace/workspace-sidebar.tsx
    - src/app/(workspace)/[workspaceSlug]/layout.tsx
    - src/app/(workspace)/[workspaceSlug]/page.tsx
    - src/server/redis.ts
    - src/server/socket/index.ts
    - src/server/socket/handlers/message.ts
decisions:
  - id: WS-04
    choice: "Store last-visited path in Redis with 30-day TTL"
    rationale: "Workspace navigation context useful for weeks but doesn't need permanent storage"
  - id: WS-05
    choice: "Workspace switcher fetches member counts at layout load time"
    rationale: "Member count changes infrequently, acceptable to fetch server-side once per page load"
  - id: WS-06
    choice: "Notify all workspace members on message send for workspace unread updates"
    rationale: "Ensures real-time workspace switcher badge accuracy, load mitigated by Redis cache"
metrics:
  duration: 375s
  completed: 2026-01-23
---

# Phase 33 Plan 02: Workspace Switcher UI Summary

**One-liner:** Dropdown workspace switcher with preview cards, real-time unread counts, and last-visited position restoration via Redis

## What Was Built

Created a fully functional workspace switcher with real-time updates and position memory:

1. **Workspace Preview Components**
   - `WorkspaceCard` displays workspace logo (or initial placeholder), name, unread badge, member count, and last activity
   - Unread badge shows "99+" for counts over 99, styled as red destructive badge
   - Active workspace highlighted with subtle background
   - Uses date-fns formatDistanceToNow for human-readable last activity

2. **Workspace Switcher Dropdown**
   - `WorkspaceSwitcher` component with Radix DropdownMenu integration
   - Trigger shows current workspace name with chevron icon
   - Dropdown content (w-80) displays all user workspaces as preview cards
   - Uses `useWorkspaceUnreadCounts` hook for real-time unread counts
   - Stores last-visited path before switching workspaces (POST to API)
   - "Browse workspaces" link at bottom with external link icon
   - Integrated into sidebar header, replacing static workspace name link

3. **Last-Visited Position Storage**
   - Added `storeLastVisited` and `getLastVisited` functions to redis.ts
   - Redis keys: `user:{userId}:workspace:{workspaceId}:last-visited`
   - 30-day TTL on stored paths
   - API route `/api/workspace/last-visited` with POST and GET handlers
   - Validates workspace membership before storing/retrieving
   - Workspace root page restores last-visited position on load
   - Prevents redirect loops by checking if path is workspace root

4. **Socket Integration**
   - Registered `workspaceUnreadManager` in socket/index.ts
   - Added `getWorkspaceUnreadManager` export function
   - Message handler emits `workspace:unreadUpdate` to all workspace members
   - Fetches organizationId from channel or conversation for workspace context
   - Notifies all members (except sender) when message affects workspace unreads
   - Real-time workspace switcher badge updates on message activity

5. **Layout Integration**
   - Workspace layout fetches all user workspaces with member counts
   - Passes `workspaces` prop to WorkspaceSidebar component
   - Falls back to simple link if workspaces data unavailable
   - Fetches member counts via better-auth API for each workspace

## Technical Decisions

### Last-Visited Redis Storage with 30-day TTL (WS-04)

Workspace navigation context is valuable for user experience but doesn't require permanent storage. 30-day TTL balances memory usage with practical session duration.

### Member Count Fetching at Layout Load (WS-05)

Member counts change infrequently (only when users join/leave workspace). Fetching server-side once per page load is simpler than real-time updates and acceptable for this use case.

### Workspace Unread Notifications to All Members (WS-06)

To keep workspace switcher badges accurate, we notify all workspace members when a message is sent. This creates more socket events but is mitigated by Redis caching (30s TTL) and ensures consistent UI state.

## Files Changed

**Created:**
- `src/components/workspace/workspace-card.tsx` - Preview card component with logo, name, badges, metadata
- `src/components/workspace/workspace-switcher.tsx` - Dropdown switcher with unread counts and navigation
- `src/app/api/workspace/last-visited/route.ts` - API route for storing/retrieving last-visited paths

**Modified:**
- `src/components/workspace/workspace-sidebar.tsx` - Integrated WorkspaceSwitcher in header, added workspaces prop
- `src/app/(workspace)/[workspaceSlug]/layout.tsx` - Fetches all workspaces with member counts, passes to sidebar
- `src/app/(workspace)/[workspaceSlug]/page.tsx` - Restores last-visited position on workspace root load
- `src/server/redis.ts` - Added storeLastVisited and getLastVisited helper functions
- `src/server/socket/index.ts` - Registered workspace unread manager and handlers
- `src/server/socket/handlers/message.ts` - Emits workspace unread updates to all members on message send

## Next Phase Readiness

**Ready for Phase 33-03 (Browse Workspaces Page):**
- Workspace switcher includes "Browse workspaces" link that needs destination
- No blockers for building workspace discovery and join request UI

**No Blockers**

## Deviations from Plan

None - plan executed exactly as written.

## Verification

✓ TypeScript compiles without errors
✓ Workspace switcher visible in sidebar header
✓ All user workspaces appear in dropdown
✓ Unread counts display per workspace
✓ Last-visited position stored and restored
✓ "Browse workspaces" link present at bottom
✓ Socket handlers registered and emit workspace unread updates

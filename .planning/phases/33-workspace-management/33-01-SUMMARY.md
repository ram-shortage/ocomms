---
phase: 33
plan: 01
subsystem: workspace-management
tags: [database, schema, socket-io, real-time, unread-counts]
requires: [32-07]
provides: [workspace-join-request-schema, workspace-unread-aggregation]
affects: [33-02, 33-03]
tech-stack:
  added: []
  patterns: [workspace-unread-aggregation, sql-lateral-join]
key-files:
  created:
    - src/db/schema/workspace-join-request.ts
    - src/lib/hooks/use-workspace-unread.ts
    - src/server/socket/handlers/workspace-unread.ts
    - src/db/migrations/0006_flawless_the_executioner.sql
  modified:
    - src/db/schema/index.ts
    - src/lib/socket-events.ts
decisions:
  - id: WS-01
    choice: "SQL aggregation with LATERAL joins for workspace unreads"
    rationale: "Single query per workspace more efficient than per-channel/conversation queries"
  - id: WS-02
    choice: "30-second Redis cache TTL for workspace unreads"
    rationale: "Balance between freshness and database load, workspace-level less critical than message-level"
  - id: WS-03
    choice: "Unique constraint on (userId, organizationId) for join requests"
    rationale: "Prevent duplicate pending requests from same user to same workspace"
metrics:
  duration: 305s
  completed: 2026-01-23
---

# Phase 33 Plan 01: Workspace Management Foundation Summary

**One-liner:** Database schema for join requests and efficient workspace-level unread count aggregation via socket events

## What Was Built

Created the foundation for workspace management functionality:

1. **Join Request Schema**
   - New `workspace_join_requests` table with all required fields
   - Support for pending/approved/rejected status workflow
   - Optional message from requester and rejection reason from admin
   - Unique constraint prevents duplicate pending requests
   - Foreign keys to users and organizations with proper cascade behavior

2. **Workspace Unread Aggregation**
   - Client hook `useWorkspaceUnreadCounts` for fetching and subscribing to workspace-level unreads
   - Socket events `workspace:fetchUnreads` and `workspace:unreadUpdate`
   - Server handler using efficient SQL aggregation with LATERAL joins
   - Combines channel unreads + conversation unreads per workspace
   - Redis caching with 30-second TTL to reduce database load
   - Authorization checks via `isOrganizationMember`

3. **Database Migration**
   - Generated and applied migration 0006
   - Table structure verified with all constraints and indexes

## Technical Decisions

### SQL Aggregation Strategy (WS-01)

Used LATERAL joins to efficiently compute workspace-level unreads:

```sql
-- Channel unreads
SELECT COALESCE(SUM(max_seq - last_read), 0)
FROM channels
INNER JOIN channel_members ON (channel_id = channels.id AND user_id = ?)
LEFT JOIN channel_read_state ON (channel_id = channels.id AND user_id = ?)
LEFT JOIN LATERAL (
  SELECT COALESCE(MAX(sequence), 0) as max_seq
  FROM messages
  WHERE channel_id = channels.id AND deleted_at IS NULL
) max_seq ON true
WHERE organization_id = ?

UNION ALL

-- Conversation unreads (same pattern)
```

**Why:** Single aggregation query per workspace is far more efficient than N queries (one per channel/conversation). LATERAL join allows us to compute max sequence for each channel/conversation inline.

**Alternative considered:** Loop through all channels and conversations calling existing unread functions - rejected due to N+1 query problem and poor scalability.

### Workspace Unread Cache TTL (WS-02)

Set Redis cache TTL to 30 seconds (vs 60 seconds for channel-level unreads).

**Why:** Workspace-level unreads are less critical for instant accuracy than message-level unreads. Users care most about which workspace has activity, not exact counts. The shorter TTL balances freshness with reduced database queries.

**Trade-off:** Slightly more database load than 60-second TTL, but workspace unreads are only fetched when user opens switcher (less frequent than message views).

### Join Request Unique Constraint (WS-03)

Added unique index on `(user_id, organization_id)` at database level.

**Why:** Database-level constraint is the only reliable way to prevent race conditions where a user submits multiple requests in quick succession. Application-level checks are insufficient.

**Note:** Constraint applies to ALL records (pending, approved, rejected). This means a user can only have one join request record per workspace at a time. To request again after rejection, the admin must delete the rejected request or we need a cron job to clean up old rejected requests.

## Commits

1. `848558b` - feat(33-01): add workspace join request schema
   - Created workspace-join-request.ts with table definition
   - Added relations for user, organization, reviewer
   - Exported from schema index

2. `08e6e5a` - feat(33-01): add workspace unread aggregation and socket handlers
   - Added workspace socket events to socket-events.ts
   - Created useWorkspaceUnreadCounts client hook
   - Implemented setupWorkspaceUnreadHandlers with SQL aggregation
   - Redis caching and authorization checks

3. `f29f008` - chore(33-01): run database migration for workspace join requests
   - Generated migration 0006
   - Applied to database successfully
   - Verified table structure and constraints

## Files Changed

**Created:**
- `src/db/schema/workspace-join-request.ts` - Join request schema with relations
- `src/lib/hooks/use-workspace-unread.ts` - Client hook for workspace unreads
- `src/server/socket/handlers/workspace-unread.ts` - Socket handler with SQL aggregation
- `src/db/migrations/0006_flawless_the_executioner.sql` - Migration file

**Modified:**
- `src/db/schema/index.ts` - Exported workspace-join-request schema
- `src/lib/socket-events.ts` - Added workspace:fetchUnreads and workspace:unreadUpdate events

## Integration Points

**For Plan 02 (Workspace Switcher UI):**
- Use `useWorkspaceUnreadCounts(workspaceIds)` hook to display unread badges
- Subscribe to `workspace:unreadUpdate` events for real-time updates
- Display workspace cards with unread counts

**For Plan 03 (Browse & Join Flow):**
- Create join requests using `workspaceJoinRequests` table
- Query pending requests for admin approval UI
- Update request status (approved/rejected) with optional rejection reason

**For Socket Index:**
- Register `handleWorkspaceUnreadEvents` in socket connection handler
- Initialize `setupWorkspaceUnreadHandlers(io, redis)` and pass manager to handlers

## Performance Characteristics

**Workspace Unread Query:**
- 2 aggregation queries per workspace (channels + conversations)
- LATERAL join computes max sequence inline (no subquery per row)
- Redis cache reduces to 1 query per workspace per 30 seconds
- Authorization check adds 1 query per workspace (membership lookup)

**Estimated load for 10 workspaces:**
- Cache hit: 10 authorization queries only
- Cache miss: 10 auth + 20 aggregation queries = 30 queries
- With 30s TTL: ~30 queries/30s = 1 query/second sustained

**Scalability:**
- Query performance depends on number of channels/conversations per workspace
- Indexes on `channels.organization_id` and `conversations.organization_id` critical
- Consider materialized view for very large workspaces (future optimization)

## Testing Notes

**Manual verification needed:**
1. Create join request via UI (Plan 03)
2. Verify unique constraint prevents duplicate pending requests
3. Open workspace switcher and confirm unread counts display
4. Send message in workspace and verify count updates in real-time
5. Switch workspaces and confirm counts refresh on return

**Automated tests needed (future):**
- Unit tests for workspace unread aggregation SQL
- Integration tests for socket event flow
- Load tests for N workspaces with M channels each

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Prerequisites for 33-02:**
- Socket handler registration in `src/server/socket/index.ts` (will be done in 33-02)
- Workspace switcher UI can now use `useWorkspaceUnreadCounts` hook

**Prerequisites for 33-03:**
- Join request schema ready for browse/join flow
- Admin approval UI can query `workspaceJoinRequests` table

**Technical debt:**
- Consider adding index on `(status, created_at)` if admin approval list gets slow
- May need cron job to clean up old rejected join requests (prevents re-requesting)
- Workspace unread materialized view for very large workspaces (defer until needed)

---

*Completed: 2026-01-23*
*Duration: ~5 minutes*
*Commits: 3*

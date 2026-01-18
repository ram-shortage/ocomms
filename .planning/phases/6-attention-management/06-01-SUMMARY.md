---
phase: 06-attention-management
plan: 01
subsystem: database, api
tags: [unread, read-state, socket.io, redis, drizzle, sequence-numbers]

# Dependency graph
requires:
  - phase: 03-real-time-messaging
    provides: [messages.sequence, Socket.IO rooms, Redis caching]
  - phase: 05-mentions-notifications
    provides: [user:{userId} rooms for personal delivery]
provides:
  - channelReadState schema for per-user-per-channel read tracking
  - unread:fetch, unread:markRead, unread:markMessageUnread socket events
  - unread:update server-to-client event for real-time updates
  - UnreadManager with Redis caching (60s TTL, graceful fallback)
  - automatic unread notifications on new messages
affects: [06-02-sidebar-unread-ui, 06-03-mark-as-read-actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sequence-based read tracking (lastReadSequence vs max message sequence)"
    - "Redis cache-first pattern for unread counts with 60s TTL"
    - "markedUnreadAtSequence for mark-as-unread feature"

key-files:
  created:
    - src/db/schema/channel-read-state.ts
    - src/server/socket/handlers/unread.ts
  modified:
    - src/db/schema/index.ts
    - src/lib/socket-events.ts
    - src/server/socket/index.ts
    - src/server/socket/handlers/message.ts

key-decisions:
  - "Sequence-based tracking using existing message.sequence field"
  - "Single channelReadState table handles both channels and conversations"
  - "60s Redis TTL with graceful fallback to DB-only when Redis unavailable"

patterns-established:
  - "UnreadManager pattern: module-level manager with getUnreadManager() accessor"
  - "Cache invalidation on state change: always invalidate before computing new count"

# Metrics
duration: 4min
completed: 2026-01-18
---

# Phase 6 Plan 01: Read State Schema and Backend Handlers Summary

**channelReadState schema with sequence-based tracking, UnreadManager with Redis caching, real-time unread updates on new messages**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-18T09:51:29Z
- **Completed:** 2026-01-18T09:55:11Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Created channelReadState table with proper indexes for user+channel and user+conversation
- Implemented UnreadManager with getUnreadCount, markAsRead, markMessageAsUnread
- Added Redis caching with 60s TTL and graceful fallback for non-Redis environments
- Integrated unread notifications into message handler for automatic updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Channel read state schema** - `9b9b8c9` (feat)
2. **Task 2: Unread socket handlers** - `bbd9494` (feat)
3. **Task 3: Register handlers and integrate with message handler** - `b888af4` (feat)

## Files Created/Modified
- `src/db/schema/channel-read-state.ts` - Per-user-per-channel read state table with lastReadSequence and markedUnreadAtSequence
- `src/db/schema/index.ts` - Export channelReadState schema
- `src/lib/socket-events.ts` - Added unread:update, unread:fetch, unread:markRead, unread:markMessageUnread events
- `src/server/socket/handlers/unread.ts` - UnreadManager with Redis caching and socket event handlers
- `src/server/socket/index.ts` - Setup unreadManager and register handleUnreadEvents
- `src/server/socket/handlers/message.ts` - Call notifyUnreadIncrement after message:new

## Decisions Made
- **Sequence-based tracking:** Uses existing message.sequence field for unread counts (unread = maxSequence - effectiveReadSequence)
- **Single table for channels and DMs:** channelReadState handles both with optional channelId/conversationId FK
- **Partial unique indexes:** User+channel and user+conversation each have unique index with WHERE clause
- **60s Redis TTL:** Balances cache freshness with Redis load, graceful fallback to DB-only
- **markedUnreadAtSequence pattern:** When set, effective read = MIN(lastReadSequence, markedUnreadAtSequence - 1)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. Redis is optional (graceful fallback to DB-only).

## Next Phase Readiness
- Schema and handlers ready for frontend integration
- Next plan (06-02) can implement sidebar unread badges using unread:fetch and unread:update events
- Can also implement mark-as-read on channel navigation using unread:markRead

---
*Phase: 06-attention-management*
*Completed: 2026-01-18*

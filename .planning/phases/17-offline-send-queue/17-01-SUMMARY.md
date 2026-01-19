---
phase: 17-offline-send-queue
plan: 01
subsystem: cache
tags: [indexeddb, dexie, offline, queue, backoff, retry]

# Dependency graph
requires:
  - phase: 16-message-caching
    provides: Dexie IndexedDB foundation with message caching
provides:
  - SendStatus type for pending/sending/sent/failed states
  - QueuedMessage interface for offline message persistence
  - sendQueue table in Dexie schema (version 2)
  - Queue CRUD operations (queueMessage, updateQueueStatus, getPendingMessages, removeFromQueue)
  - Exponential backoff utility with jitter
affects: [17-02, 17-03, useSendMessage hook, queue processor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Send queue with status tracking (pending/sending/sent/failed)
    - Exponential backoff with jitter for retry
    - Compound index [targetId+status] for efficient pending queries

key-files:
  created:
    - src/lib/cache/send-queue.ts
    - src/lib/retry/backoff.ts
  modified:
    - src/lib/cache/db.ts
    - src/lib/cache/index.ts

key-decisions:
  - "Dexie version 2 schema for sendQueue table"
  - "Compound index [targetId+status] for efficient pending message queries by target"
  - "AWS-style exponential backoff: baseDelay*2^attempt + jitter"
  - "Default 5 max retries, 30s max delay, 500ms jitter"
  - "Graceful error handling pattern (log but don't throw) for queue operations"

patterns-established:
  - "Send queue CRUD operations follow messages.ts graceful error handling"
  - "Retry utility in separate src/lib/retry/ directory"
  - "Queue status transitions: pending -> sending -> sent OR failed"

# Metrics
duration: 8min
completed: 2026-01-19
---

# Phase 17 Plan 01: Queue Infrastructure Summary

**Dexie sendQueue table with status tracking and AWS-style exponential backoff for offline message persistence**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-19T10:00:00Z
- **Completed:** 2026-01-19T10:08:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Extended Dexie schema to version 2 with sendQueue table for offline message persistence
- Created queue CRUD operations with graceful error handling
- Implemented exponential backoff with jitter following AWS best practices

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Dexie schema with sendQueue table** - `b8aff5a` (feat)
2. **Task 2: Create queue operations module** - `9d1840b` (feat)
3. **Task 3: Create exponential backoff utility and update exports** - `aa664bc` (feat)

## Files Created/Modified
- `src/lib/cache/db.ts` - Added SendStatus, QueuedMessage types and sendQueue table schema
- `src/lib/cache/send-queue.ts` - Queue CRUD operations (queueMessage, updateQueueStatus, etc.)
- `src/lib/retry/backoff.ts` - Exponential backoff calculation with jitter
- `src/lib/cache/index.ts` - Exports for new queue types and operations

## Decisions Made
- Used compound index [targetId+status] for efficient queries of pending messages by channel/conversation
- Applied graceful error handling pattern from messages.ts (log errors, don't throw)
- Exponential backoff formula: min(maxDelay, baseDelay * 2^attempt) + random(0, maxJitter)
- Default config: 1s base delay, 30s max delay, 500ms jitter, 5 max retries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Queue infrastructure ready for 17-02 (Queue Processing)
- sendQueue table schema provides status tracking for queue processor
- Backoff utility ready for retry logic in processQueue()
- All exports available from @/lib/cache module

---
*Phase: 17-offline-send-queue*
*Completed: 2026-01-19*

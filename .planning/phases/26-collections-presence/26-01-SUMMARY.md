---
phase: 26-collections-presence
plan: 01
subsystem: database
tags: [drizzle, postgres, bullmq, bookmarks, user-status]

# Dependency graph
requires:
  - phase: 25-job-queue
    provides: BullMQ queue infrastructure and patterns
provides:
  - Bookmarks table with polymorphic message/file references
  - User status table with emoji, text, expiration, DND
  - Status expiration queue for auto-clear jobs
affects: [26-02-bookmarks-actions, 26-03-status-actions, 26-04-presence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Polymorphic references with nullable foreign keys
    - Unique composite indexes for deduplication

key-files:
  created:
    - src/db/schema/bookmark.ts
    - src/db/schema/user-status.ts
    - src/server/queue/status-expiration.queue.ts
  modified:
    - src/db/schema/index.ts
    - src/server/queue/index.ts

key-decisions:
  - "Polymorphic bookmarks via nullable messageId/fileId with type enum"
  - "One status per user enforced via unique constraint on userId"
  - "Status expiration uses same BullMQ pattern as reminders (3 attempts, exponential backoff)"

patterns-established:
  - "Polymorphic references: Use type enum + nullable FKs instead of separate tables"
  - "One-to-one constraint: Unique index on foreign key column"

# Metrics
duration: 2min
completed: 2026-01-21
---

# Phase 26 Plan 01: Schema Foundation Summary

**Database schema for bookmarks (polymorphic message/file) and user status (emoji, text, expiration, DND) with BullMQ expiration queue**

## Performance

- **Duration:** 2 min 15 sec
- **Started:** 2026-01-21T08:52:49Z
- **Completed:** 2026-01-21T08:55:04Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created bookmarks table with polymorphic references to messages and files
- Created user_statuses table with emoji, text, expiration, and DND support
- Created status-expiration BullMQ queue for auto-clearing expired statuses
- All schemas exported and type-checked successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bookmarks table schema** - `64d8d9d` (feat)
2. **Task 2: Create user status table schema** - `4602efa` (feat)
3. **Task 3: Create status expiration queue definition** - `034aa9a` (feat)

## Files Created/Modified

- `src/db/schema/bookmark.ts` - Bookmarks table with polymorphic message/file references, unique indexes per user
- `src/db/schema/user-status.ts` - User status with emoji, text, expiresAt, dndEnabled, jobId
- `src/server/queue/status-expiration.queue.ts` - BullMQ queue for status auto-expiration
- `src/db/schema/index.ts` - Added exports for bookmark and user-status
- `src/server/queue/index.ts` - Added export for statusExpirationQueue

## Decisions Made

1. **Polymorphic bookmarks approach** - Used nullable messageId/fileId with bookmarkTypeEnum rather than separate tables. This keeps queries simple while allowing both message and file bookmarks in one table.

2. **One status per user** - Enforced via unique constraint on userId in userStatuses table. Upsert pattern will be used in actions (update if exists, insert if not).

3. **Status expiration queue config** - Matched reminder queue settings (3 attempts, exponential backoff with 1s base) for consistency across job queues.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all schemas created and verified successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Database schema ready for server actions in 26-02 (bookmarks) and 26-03 (status)
- Status expiration queue ready for worker processor implementation
- Migration will run automatically when dev server starts with database connection

---
*Phase: 26-collections-presence*
*Completed: 2026-01-21*

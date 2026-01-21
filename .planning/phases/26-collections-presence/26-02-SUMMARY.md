---
phase: 26-collections-presence
plan: 02
subsystem: api
tags: [server-actions, bullmq, bookmarks, user-status, drizzle]

# Dependency graph
requires:
  - phase: 26-01
    provides: Bookmark and user-status schemas, status-expiration queue
provides:
  - Bookmark CRUD server actions (toggle, list, check, remove)
  - User status CRUD server actions (set, clear, get) with BullMQ integration
  - Status expiration worker with jobId race condition protection
affects: [26-03-ui, 26-04-presence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server action BullMQ job management (cancel old job, schedule new)
    - Polymorphic access verification (message via channel/DM membership)
    - JobId verification to prevent race conditions in delayed jobs

key-files:
  created:
    - src/lib/actions/bookmark.ts
    - src/lib/actions/user-status.ts
    - src/workers/status-expiration.worker.ts
  modified:
    - src/workers/index.ts

key-decisions:
  - "Bookmark access verification reuses message access pattern from reminders"
  - "User status upsert with manual update/insert instead of onConflictDoUpdate for clarity"
  - "JobId format includes timestamp for uniqueness: status-${userId}-${Date.now()}"

patterns-established:
  - "BullMQ job cancellation: Get job by ID, remove if exists, then add new job"
  - "Status expiration race condition prevention: Compare job.id with stored jobId"

# Metrics
duration: 4min
completed: 2026-01-21
---

# Phase 26 Plan 02: Server Actions Summary

**Server actions for bookmark CRUD and user status management with BullMQ expiration scheduling and race condition protection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-21T08:56:00Z
- **Completed:** 2026-01-21T09:00:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created bookmark server actions with toggle, list, check, and remove operations
- Created user status server actions with set, clear, and get operations plus DND support
- Created status expiration worker with jobId verification to prevent race conditions
- Exported STATUS_PRESETS constant for UI preset selection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bookmark server actions** - `412298f` (feat - from prior session)
2. **Task 2: Create user status server actions** - `816bc9c` (feat)
3. **Task 3: Create status expiration worker and register** - `db6552d` (feat)

## Files Created/Modified

- `src/lib/actions/bookmark.ts` - Bookmark CRUD with polymorphic message/file support and access verification
- `src/lib/actions/user-status.ts` - User status CRUD with BullMQ job scheduling for expiration
- `src/workers/status-expiration.worker.ts` - Worker processor that clears status and verifies jobId match
- `src/workers/index.ts` - Registered status expiration worker with graceful shutdown

## Decisions Made

1. **Bookmark access verification** - Reused the verifyMessageAccess pattern from reminder.ts for message bookmarks. File bookmarks verify the file exists and (if attached to a message) verify message access.

2. **User status upsert approach** - Used explicit check-then-update/insert pattern instead of onConflictDoUpdate for clearer control over job management during updates.

3. **JobId uniqueness** - Format `status-${userId}-${Date.now()}` ensures each job is uniquely identifiable even if a user rapidly changes their status.

## Deviations from Plan

### Prior Session Overlap

**1. [Note] Bookmark.ts already committed**
- **Found during:** Task 1 execution
- **Issue:** bookmark.ts was already in HEAD from commit 412298f (labeled as 26-03)
- **Impact:** No re-commit needed; file was verified to match plan specification
- **Resolution:** Proceeded with remaining tasks

---

**Total deviations:** 1 noted (prior session overlap)
**Impact on plan:** No functional impact. All actions exist as specified.

## Issues Encountered

None - all server actions created and type-checked successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Bookmark actions ready for UI integration (bookmark button, saved items list)
- User status actions ready for status picker and display components
- Status expiration worker ready to auto-clear statuses when jobs fire
- isUserDndEnabled export available for notification filtering

---
*Phase: 26-collections-presence*
*Completed: 2026-01-21*

---
phase: 25-job-queue-foundation
plan: 01
subsystem: infra
tags: [bullmq, redis, job-queue, workers, ioredis]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Redis and ioredis already configured
provides:
  - BullMQ queue infrastructure for scheduled-messages and reminders
  - Worker entry point with placeholder processors
  - npm scripts for worker process management
affects: [25-02, 25-03, 25-04, scheduled-messages, reminders]

# Tech tracking
tech-stack:
  added: [bullmq@5.66.5]
  patterns: [separate-worker-process, connection-options-pattern, graceful-shutdown]

key-files:
  created:
    - src/server/queue/connection.ts
    - src/server/queue/scheduled-message.queue.ts
    - src/server/queue/reminder.queue.ts
    - src/server/queue/index.ts
    - src/workers/index.ts
  modified:
    - package.json

key-decisions:
  - "Use ConnectionOptions instead of Redis instance to avoid ioredis type conflicts between project and BullMQ versions"
  - "Separate worker process from Next.js server for non-blocking job processing"
  - "Configure 3 attempts with exponential backoff (1s base) for job retries"

patterns-established:
  - "Queue connection via options object: getQueueConnection() returns ConnectionOptions not Redis instance"
  - "Worker graceful shutdown: Handle SIGTERM/SIGINT, close all workers, exit cleanly"
  - "Queue cleanup limits: removeOnComplete 100, removeOnFail 500"

# Metrics
duration: 8min
completed: 2026-01-20
---

# Phase 25 Plan 01: BullMQ Infrastructure Summary

**BullMQ queue infrastructure with scheduled-messages and reminders queues, worker entry point, and npm scripts**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-20T22:33:00Z
- **Completed:** 2026-01-20T22:41:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Installed BullMQ 5.66.5 for persistent job queue processing
- Created queue definitions for scheduled-messages and reminders with retry/backoff config
- Built worker entry point with placeholder processors ready for real implementation
- Added npm scripts for dev (with watch) and production worker execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Install BullMQ and create Redis connection factory** - `89b3b14` (chore)
2. **Task 2: Create queue definitions** - `113bf8a` (feat)
3. **Task 3: Create worker entry point and npm scripts** - `db742b0` (feat)

## Files Created/Modified
- `src/server/queue/connection.ts` - Redis connection factory returning ConnectionOptions for BullMQ
- `src/server/queue/scheduled-message.queue.ts` - Scheduled messages queue with ScheduledMessageJobData type
- `src/server/queue/reminder.queue.ts` - Reminders queue with ReminderJobData type
- `src/server/queue/index.ts` - Re-exports all queue modules
- `src/workers/index.ts` - Worker entry point with placeholder processors and graceful shutdown
- `package.json` - Added bullmq dependency and worker/worker:prod scripts

## Decisions Made
- **ConnectionOptions pattern:** Used BullMQ's ConnectionOptions type instead of raw Redis instance to avoid type conflicts between project ioredis@5.9.2 and BullMQ's bundled ioredis@5.9.1
- **Simple worker script:** Removed dotenv CLI wrapper in favor of code-based env loading (matching server pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Type conflict between ioredis versions**
- **Found during:** Task 2 (Create queue definitions)
- **Issue:** TypeScript error - project ioredis@5.9.2 type incompatible with BullMQ's bundled ioredis@5.9.1
- **Fix:** Changed getQueueConnection() to return ConnectionOptions instead of Redis instance, letting BullMQ create its own connection
- **Files modified:** src/server/queue/connection.ts
- **Verification:** `npx tsc --noEmit` passes for all queue files
- **Committed in:** 113bf8a (Task 2 commit)

**2. [Rule 3 - Blocking] dotenv CLI not installed**
- **Found during:** Task 3 (Worker npm script)
- **Issue:** `dotenv -e .env.local -- npx tsx` failed because dotenv CLI not installed
- **Fix:** Simplified script to `tsx watch src/workers/index.ts` - the worker code already handles env loading internally like the server does
- **Files modified:** package.json
- **Verification:** `npm run worker` starts successfully and loads .env.local
- **Committed in:** db742b0 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for functionality. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in test files (offline-queue.test.ts) unrelated to this work - not addressed as out of scope

## User Setup Required

None - no external service configuration required. Uses existing REDIS_URL env var.

## Next Phase Readiness
- Queue infrastructure ready for Plan 02 (database schema)
- Worker placeholder processors ready to be replaced with real implementations in Plans 03-04
- `npm run worker` available for development testing

---
*Phase: 25-job-queue-foundation*
*Completed: 2026-01-20*

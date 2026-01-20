---
phase: 25-job-queue-foundation
plan: 02
subsystem: database
tags: [drizzle, postgres, schema, scheduled-messages, reminders, pgEnum]

# Dependency graph
requires:
  - phase: 01-database-setup
    provides: Drizzle ORM patterns, PostgreSQL configuration
  - phase: 06-thread-infrastructure
    provides: messages table schema
provides:
  - scheduled_messages table with status tracking and BullMQ job correlation
  - reminders table with recurring pattern support (daily, weekly)
  - scheduledMessageStatusEnum for message lifecycle states
  - reminderStatusEnum for reminder lifecycle states
  - reminderPatternEnum for recurring reminders (RMND-07)
affects: [25-03-worker-processes, 25-04-scheduled-message-api, 25-05-reminder-api, 25-06-scheduled-message-ui, 25-07-reminder-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pgEnum for status and pattern enums following existing conventions
    - Composite indexes for (userId, status) query patterns
    - withTimezone timestamps for all time-related columns
    - jobId field for BullMQ correlation

key-files:
  created:
    - src/db/schema/scheduled-message.ts
    - src/db/schema/reminder.ts
  modified:
    - src/db/schema/index.ts

key-decisions:
  - "Used withTimezone for all timestamp columns (scheduledFor, remindAt, sentAt, etc.) for proper UTC handling"
  - "Nullable channelId/conversationId on scheduled_messages allows either target type"
  - "Separate reminderPatternEnum for daily/weekly recurring support (RMND-07)"

patterns-established:
  - "Job queue tables store jobId for BullMQ correlation and management"
  - "Status enums include processing state for worker synchronization"

# Metrics
duration: 4min
completed: 2026-01-20
---

# Phase 25 Plan 02: Database Schemas for Scheduled Messages and Reminders Summary

**Drizzle schema for scheduled_messages and reminders tables with status enums, BullMQ job ID correlation, and recurring pattern support**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-20T22:35:15Z
- **Completed:** 2026-01-20T22:39:35Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created scheduled_messages table with lifecycle status tracking (pending, processing, sent, cancelled, failed)
- Created reminders table with recurring pattern support for daily/weekly reminders (RMND-07)
- Added proper indexes for author+status and time-based queries
- Schema exports updated and database migration applied

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scheduled_messages schema** - `b5a4e53` (feat)
2. **Task 2: Create reminders schema** - `4c75ead` (feat)
3. **Task 3: Export schemas and run migration** - `c46a363` (feat)

## Files Created/Modified
- `src/db/schema/scheduled-message.ts` - Scheduled messages table with status enum, relations to users/channels/conversations/messages
- `src/db/schema/reminder.ts` - Reminders table with status and pattern enums, relations to users/messages
- `src/db/schema/index.ts` - Added exports for new schemas

## Decisions Made
- Used `withTimezone: true` for all timestamp columns to ensure proper UTC handling in BullMQ workers
- Made channelId and conversationId nullable on scheduled_messages to support either channel or DM targets
- Created separate reminderPatternEnum with only daily/weekly options (per CONTEXT.md scope)
- Followed existing schema conventions from message.ts and notification.ts for foreign key patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in test files (offline-queue.test.ts, audit.test.ts) unrelated to this plan
- Database push required environment variables from .env.local (resolved by exporting vars before command)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema foundation ready for BullMQ worker implementation (25-03)
- Tables ready for API endpoints (25-04, 25-05)
- Relations properly set up for UI queries

---
*Phase: 25-job-queue-foundation*
*Completed: 2026-01-20*

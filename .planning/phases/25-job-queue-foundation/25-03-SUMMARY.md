---
phase: 25-job-queue-foundation
plan: 03
subsystem: feature
tags: [scheduled-messages, bullmq, socket.io, redis-emitter, date-fns, ui-components]

# Dependency graph
requires:
  - phase: 25-01
    provides: BullMQ queue infrastructure and worker entry point
  - phase: 25-02
    provides: scheduled_messages database schema with status tracking
provides:
  - Scheduled message server actions (create, get, update, cancel, sendNow)
  - Schedule send dropdown UI integrated into message input
  - Scheduled messages list page with edit/cancel/send-now actions
  - Worker processor that creates messages and broadcasts via Socket.IO
affects: [25-04, 25-05, scheduled-messages-feature]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Gmail-style schedule send dropdown with quick-picks and custom time
    - Server action pattern for scheduled message management
    - Worker-to-Socket.IO broadcasting via Redis emitter
    - Atomic message sequence generation with retry

key-files:
  created:
    - src/lib/actions/scheduled-message.ts
    - src/components/schedule/schedule-send-dropdown.tsx
    - src/components/schedule/scheduled-messages-list.tsx
    - src/components/schedule/scheduled-message-edit-dialog.tsx
    - src/app/(workspace)/[workspaceSlug]/scheduled/page.tsx
    - src/workers/scheduled-message.worker.ts
  modified:
    - src/components/message/message-input.tsx
    - src/components/workspace/workspace-sidebar.tsx
    - src/workers/index.ts

key-decisions:
  - "Use shared emitter from @/server/queue/emitter instead of creating separate Redis connection in worker"
  - "Schedule feedback shown inline in message input (no toast system needed)"
  - "Quick-pick presets: Tomorrow 9am and Monday 9am (deliberately minimal per CONTEXT.md)"

patterns-established:
  - "Scheduled action pattern: createScheduledMessage adds DB record + BullMQ delayed job, stores jobId for management"
  - "Schedule UI pattern: Split button with popover for quick-picks and datetime-local for custom"
  - "Worker broadcast pattern: Use getEmitter() to emit to room:targetId after message creation"

# Metrics
duration: 8min
completed: 2026-01-20
---

# Phase 25 Plan 03: Scheduled Messages Feature Summary

**Gmail-style schedule send with server actions, UI components, and worker processor that broadcasts messages via Socket.IO**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-20T22:40:27Z
- **Completed:** 2026-01-20T22:48:50Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Complete scheduled message server actions with ownership verification and BullMQ job correlation
- Schedule send dropdown integrated into message input with quick-picks and custom time
- Scheduled messages list page accessible from sidebar with edit/cancel/send-now actions
- Worker processor that creates actual messages and broadcasts via Socket.IO Redis emitter

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scheduled message server actions** - `c17adb9` (feat)
2. **Task 2: Create schedule send UI components** - `5752c9d` (feat)
3. **Task 3: Implement worker processor for scheduled messages** - `430d80d` (feat)

## Files Created/Modified
- `src/lib/actions/scheduled-message.ts` - Server actions for CRUD operations on scheduled messages
- `src/components/schedule/schedule-send-dropdown.tsx` - Split button with schedule popover (155 lines)
- `src/components/schedule/scheduled-messages-list.tsx` - List view with actions (242 lines)
- `src/components/schedule/scheduled-message-edit-dialog.tsx` - Dialog for editing content and time
- `src/app/(workspace)/[workspaceSlug]/scheduled/page.tsx` - Page to display scheduled messages
- `src/workers/scheduled-message.worker.ts` - Worker processor (174 lines)
- `src/components/message/message-input.tsx` - Replaced Send button with ScheduleSendDropdown
- `src/components/workspace/workspace-sidebar.tsx` - Added Scheduled link with Clock icon
- `src/workers/index.ts` - Updated to use real scheduled message worker

## Decisions Made
- Used shared Redis emitter singleton instead of creating new connection in worker (consistency with reminder worker pattern)
- Added schedule feedback inline below message input instead of implementing toast system (simpler, effective)
- Worker uses same atomic sequence generation pattern as message handler with retry for collision handling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type mismatch in updateScheduledMessage**
- **Found during:** Task 1 (Server actions)
- **Issue:** job.id returns `string | undefined` but schema expects `string | null`
- **Fix:** Added `?? null` fallback when assigning job.id to updateValues
- **Files modified:** src/lib/actions/scheduled-message.ts
- **Committed in:** c17adb9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix for correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in test files (offline-queue.test.ts, audit.test.ts, message-list.test.tsx) unrelated to this work - not addressed as out of scope

## User Setup Required

None - no external service configuration required. Uses existing REDIS_URL and DATABASE_URL env vars.

## Next Phase Readiness
- Scheduled messages feature complete (SCHD-01 through SCHD-07)
- Worker processes jobs and broadcasts via Socket.IO
- Ready for Plan 04 (Reminders) which follows similar patterns
- Manual testing recommended: schedule a message for 1 minute in future and verify it appears in channel

---
*Phase: 25-job-queue-foundation*
*Completed: 2026-01-20*

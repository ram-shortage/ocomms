---
phase: 17-offline-send-queue
plan: 02
subsystem: cache
tags: [socket.io, offline, queue, backoff, sync, background-sync]

# Dependency graph
requires:
  - phase: 17-offline-send-queue
    provides: Queue infrastructure with Dexie sendQueue table and backoff utility
provides:
  - Queue processor with Socket.io integration
  - Sync event listeners for online/visibility/socket connect
  - Background Sync API registration (Chrome)
affects: [17-03, useSendMessage hook, PWAProvider integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Queue processing with concurrent execution guard
    - Socket emit with timeout and callback pattern
    - Sync triggers with jitter for thundering herd prevention

key-files:
  created:
    - src/lib/cache/queue-processor.ts
    - src/lib/cache/sync-on-reconnect.ts
  modified:
    - src/lib/cache/index.ts

key-decisions:
  - "10 second timeout for socket send operations"
  - "Random jitter 0-500ms on socket connect to prevent thundering herd"
  - "Rate limit errors use server's retryAfter instead of exponential backoff"

patterns-established:
  - "Queue processor guards against concurrent execution with isProcessing flag"
  - "Socket messages route to message:send or thread:reply based on parentId"
  - "Sync listeners cleanup removes all event handlers and nulls socket reference"

# Metrics
duration: 6min
completed: 2026-01-19
---

# Phase 17 Plan 02: Queue Processing Summary

**Socket.io queue processor with exponential backoff, sync-on-reconnect listeners for online/visibility/socket events, and Background Sync API registration**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-19T10:15:00Z
- **Completed:** 2026-01-19T10:21:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created queue processor that sends pending messages via Socket.io when online
- Implemented retry with exponential backoff and special handling for rate limit errors
- Added sync event listeners for online, visibility change, and socket connect events
- Registered Background Sync API for Chrome (with graceful fallback for Safari)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create queue processor with socket integration** - `999dae4` (feat)
2. **Task 2: Create sync-on-reconnect listeners** - `db6254e` (feat)
3. **Task 3: Update cache barrel exports** - `7846e75` (feat)

## Files Created/Modified
- `src/lib/cache/queue-processor.ts` - Processes pending messages via Socket.io with backoff
- `src/lib/cache/sync-on-reconnect.ts` - Event listeners for triggering queue processing
- `src/lib/cache/index.ts` - Exports for queue processor and sync modules

## Decisions Made
- Used 10 second timeout for socket send operations (balance between giving up too early and hanging too long)
- Added random jitter 0-500ms on socket connect event to prevent thundering herd when server restarts
- Rate limit errors use server's retryAfter value instead of exponential backoff (respects server's guidance)
- Guard against concurrent queue processing with module-level isProcessing flag

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Queue processing infrastructure ready for 17-03 (useSendMessage hook)
- processQueue and sync listeners available from @/lib/cache module
- Integration point: call initSyncOnReconnect(socket) when socket is ready
- Integration point: call processQueue(socket) after queueing a message while online

---
*Phase: 17-offline-send-queue*
*Completed: 2026-01-19*

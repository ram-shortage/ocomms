---
phase: 17-offline-send-queue
plan: 03
subsystem: ui
tags: [hooks, optimistic-ui, indexeddb, dexie, react, offline]

# Dependency graph
requires:
  - phase: 17-offline-send-queue/17-01
    provides: Queue infrastructure (queueMessage, QueuedMessage type, sendQueue table)
  - phase: 17-offline-send-queue/17-02
    provides: Queue processing (processQueue, registerBackgroundSync)
provides:
  - useSendMessage hook for offline-first message queueing
  - useSendQueue hook for reactive pending message display
  - Optimistic UI in MessageList merging pending messages
  - Offline indicator in MessageInput
affects: [message-display, thread-replies, offline-experience]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useSendMessage hook pattern for offline-first message sending
    - useLiveQuery for reactive IndexedDB queries
    - Optimistic UI merging queued and server messages

key-files:
  created:
    - src/hooks/use-send-message.ts
    - src/lib/cache/use-send-queue.ts
  modified:
    - src/components/message/message-input.tsx
    - src/components/message/message-list.tsx
    - src/lib/cache/index.ts

key-decisions:
  - "Import processQueue and registerBackgroundSync from cache barrel for consistency"
  - "Use _isPending flag on optimistic messages for potential UI styling"
  - "Filter pending messages by matching serverId to avoid duplicates"

patterns-established:
  - "useSendMessage: always queue first, then process or register sync based on online status"
  - "useSendQueue: useLiveQuery with targetId filter and status !== 'sent' for pending display"
  - "Optimistic merge: combine server messages with pending, sort by createdAt"

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 17 Plan 03: Optimistic UI Hooks Summary

**useSendMessage and useSendQueue hooks enabling offline-first message sending with immediate UI feedback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T19:27:05Z
- **Completed:** 2026-01-19T19:30:25Z
- **Tasks:** 4 (3 planned + 1 must_have fulfillment)
- **Files modified:** 5

## Accomplishments
- Created useSendMessage hook that queues to IndexedDB and triggers processing when online
- Created useSendQueue hook with useLiveQuery for reactive pending message display
- Updated MessageInput to use offline-first queueing with offline indicator
- Integrated pending messages into MessageList for optimistic display

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useSendMessage hook** - `bc26616` (feat)
2. **Task 2: Create useSendQueue hook** - `b1be8ca` (feat)
3. **Task 3: Update MessageInput** - `3163c1a` (feat)
4. **Task 4: Integrate MessageList** - `d6f5b5c` (feat) - must_have fulfillment

## Files Created/Modified
- `src/hooks/use-send-message.ts` - Hook for queueing messages with offline support
- `src/lib/cache/use-send-queue.ts` - Reactive hook for pending message display
- `src/lib/cache/index.ts` - Added useSendQueue export
- `src/components/message/message-input.tsx` - Uses useSendMessage hook with offline indicator
- `src/components/message/message-list.tsx` - Merges pending messages for optimistic display

## Decisions Made
- Used cache barrel imports for processQueue/registerBackgroundSync (consistent with existing patterns)
- Added _isPending and _status flags to optimistic messages for potential UI differentiation
- Filter pending messages by serverId match to prevent duplicates when server confirms

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added MessageList integration for must_have fulfillment**
- **Found during:** Post-task verification
- **Issue:** Plan must_haves specified MessageList should contain useSendQueue, but no task was included
- **Fix:** Added Task 4 to integrate useSendQueue into MessageList with optimistic message merging
- **Files modified:** src/components/message/message-list.tsx
- **Verification:** useSendQueue imported and used, pendingMessages merged with display
- **Committed in:** d6f5b5c

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for complete optimistic UI experience. Must_have was documented but task omitted.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Offline send queue complete: messages can be typed and submitted offline
- Messages appear immediately in UI with optimistic display
- Queue processes automatically when online/reconnected
- Ready for phase completion and milestone integration

---
*Phase: 17-offline-send-queue*
*Completed: 2026-01-19*

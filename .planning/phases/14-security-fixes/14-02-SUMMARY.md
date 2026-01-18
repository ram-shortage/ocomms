---
phase: 14-security-fixes
plan: 02
subsystem: api
tags: [socket.io, rate-limiting, postgres, drizzle-orm, security]

# Dependency graph
requires:
  - phase: 14-01
    provides: "Plan infrastructure (will be executed in parallel)"
provides:
  - "Atomic message sequence generation with retry"
  - "Server-side message length validation (10K limit)"
  - "Per-user message rate limiting (10/60s)"
affects: [ui-polish, client-updates]

# Tech tracking
tech-stack:
  added: [rate-limiter-flexible]
  patterns: [atomic-insert-with-subquery, retry-on-constraint-violation]

key-files:
  created: []
  modified:
    - src/server/socket/handlers/message.ts
    - package.json

key-decisions:
  - "10 messages per 60 seconds rate limit per user"
  - "10,000 character max message length"
  - "3 retry attempts on sequence collision"
  - "Error codes RATE_LIMITED and MESSAGE_TOO_LONG for client handling"

patterns-established:
  - "Atomic sequence: INSERT with subquery COALESCE(MAX(sequence), 0) + 1"
  - "Retry pattern: Catch PostgreSQL 23505 and retry up to N times"
  - "Rate limit error: Include code and retryAfter in socket error"

# Metrics
duration: 8min
completed: 2026-01-18
---

# Phase 14 Plan 02: Message Handler Security Summary

**Atomic sequence generation, server-side length validation, and rate limiting for message handler using rate-limiter-flexible**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-18T22:05:00Z
- **Completed:** 2026-01-18T22:13:00Z
- **Tasks:** 2
- **Files modified:** 3 (package.json, package-lock.json, message.ts)

## Accomplishments

- Replaced race-prone SELECT MAX + INSERT with atomic INSERT using SQL subquery
- Added retry logic for PostgreSQL unique constraint violations (error code 23505)
- Server-side message length validation rejecting messages over 10,000 characters
- Per-user rate limiting at 10 messages per 60 seconds using rate-limiter-flexible
- Error responses include code and retryAfter for client-side handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Install rate-limiter-flexible** - `c29b45c` (chore)
2. **Task 2: Add atomic sequence, length check, and rate limiting** - `56f2039` (feat)

## Files Created/Modified

- `package.json` - Added rate-limiter-flexible ^9.0.1 dependency
- `package-lock.json` - Updated lock file
- `src/server/socket/handlers/message.ts` - SECFIX-03, SECFIX-05, SECFIX-06 implementations

## Decisions Made

- Rate limit: 10 messages per 60 seconds (sliding window, per-user)
- Length limit: 10,000 characters (matching CONTEXT.md decision)
- Retry attempts: 3 retries on sequence collision before failing
- Error codes: RATE_LIMITED with retryAfter, MESSAGE_TOO_LONG for client handling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sequence variable reference after refactor**
- **Found during:** Task 2 (Atomic sequence implementation)
- **Issue:** unreadManager.notifyUnreadIncrement calls used old `sequence` variable which no longer existed after moving sequence into atomic insert
- **Fix:** Changed references to use `newMessage.sequence` instead
- **Files modified:** src/server/socket/handlers/message.ts (lines 186, 190)
- **Verification:** TypeScript compilation passes
- **Committed in:** 56f2039 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correctness. No scope creep.

## Issues Encountered

None - plan executed as specified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Message handler now has SECFIX-03, SECFIX-05, SECFIX-06 implemented
- Ready for client-side rate limit and length validation UI (SECFIX-05/06 client work in later plans)
- Other SECFIX items (01, 02, 04, 07, 08) to be addressed in subsequent plans

---
*Phase: 14-security-fixes*
*Completed: 2026-01-18*

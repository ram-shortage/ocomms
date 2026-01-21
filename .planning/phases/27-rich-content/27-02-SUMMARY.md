---
phase: 27-rich-content
plan: 02
subsystem: api
tags: [bullmq, link-preview, unfurl, ssrf, socket.io, worker]

# Dependency graph
requires:
  - phase: 27-01
    provides: link_previews and message_link_previews database schema
  - phase: 25-scheduling-infra
    provides: BullMQ queue infrastructure and emitter pattern
provides:
  - URL extraction utility (extractUrls)
  - SSRF protection utility (isUrlSafe)
  - Link preview BullMQ queue
  - Link preview worker with async fetching
  - Socket.IO events for preview broadcasts
affects: [27-03, 27-04, 27-05]

# Tech tracking
tech-stack:
  added: [unfurl.js, request-filtering-agent, "@types/node-fetch"]
  patterns:
    - Custom fetch with HTTP agent for SSRF protection
    - URL extraction with regex and deduplication

key-files:
  created:
    - src/lib/url-extractor.ts
    - src/lib/ssrf-protection.ts
    - src/server/queue/link-preview.queue.ts
    - src/workers/link-preview.worker.ts
  modified:
    - src/workers/index.ts
    - src/lib/socket-events.ts
    - package.json

key-decisions:
  - "Use node-fetch v2 with request-filtering-agent for SSRF protection (Node.js native fetch doesn't support http.Agent)"
  - "Custom safeFetch wrapper for unfurl.js to integrate filtering agents"
  - "10 concurrent workers for fetch-heavy link preview processing"

patterns-established:
  - "URL extraction: regex match + Set deduplication + slice limit"
  - "SSRF protection: protocol check + file extension skip + DNS-level IP filtering"
  - "Link preview caching: check cache -> fetch if expired -> upsert -> broadcast"

# Metrics
duration: 8min
completed: 2026-01-21
---

# Phase 27 Plan 02: Link Preview Infrastructure Summary

**Async link preview pipeline with URL extraction, SSRF protection via request-filtering-agent, and BullMQ worker broadcasting via Socket.IO**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-21T10:38:00Z
- **Completed:** 2026-01-21T10:46:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- URL extractor with max 5 URLs and deduplication (LINK-02)
- SSRF protection with protocol check and file extension filtering
- Link preview BullMQ queue with 3 attempts, exponential backoff
- Worker integrates unfurl.js with custom safe fetch for DNS-level SSRF protection (LINK-07)
- 24-hour cache TTL for link previews (LINK-04)
- Socket.IO events for real-time preview broadcasts

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create URL extractor** - `3d2976d` (feat)
2. **Task 2: Create link preview queue and worker** - `5c3e82d` (feat)
3. **Task 3: Add Socket.IO event types** - `9dfced8` (feat)

## Files Created/Modified
- `src/lib/url-extractor.ts` - extractUrls function (max 5 URLs, LINK-02)
- `src/lib/ssrf-protection.ts` - isUrlSafe and FILE_EXTENSIONS_TO_SKIP
- `src/server/queue/link-preview.queue.ts` - BullMQ queue with job data interface
- `src/workers/link-preview.worker.ts` - Worker with SSRF-protected fetching
- `src/workers/index.ts` - Added link preview worker to startup/shutdown
- `src/lib/socket-events.ts` - Added linkPreview:ready and linkPreview:hidden events
- `package.json` - Added unfurl.js, request-filtering-agent, @types/node-fetch

## Decisions Made
- Used node-fetch v2 with request-filtering-agent because Node.js native fetch doesn't support http.Agent for SSRF protection
- Created custom safeFetch wrapper to integrate filtering agents with unfurl.js
- Set worker concurrency to 10 (higher than default 5) since link preview work is fetch-heavy
- Used Array.from(new Set()) instead of spread operator for TypeScript compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @types/node-fetch for type definitions**
- **Found during:** Task 2 (worker compilation)
- **Issue:** TypeScript error - Could not find declaration file for module 'node-fetch'
- **Fix:** Ran `npm install --save-dev @types/node-fetch@2`
- **Files modified:** package.json, package-lock.json
- **Verification:** Build passes, types resolve correctly
- **Committed in:** 5c3e82d (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed TypeScript Set iteration error**
- **Found during:** Task 1 (url-extractor compilation)
- **Issue:** TS2802 - Set can only be iterated with downlevelIteration flag
- **Fix:** Used Array.from(new Set()) instead of spread operator
- **Files modified:** src/lib/url-extractor.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 3d2976d (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- Had to add Socket.IO event types (Task 3) before Task 2 could compile since worker emits linkPreview:ready event

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Link preview infrastructure complete and ready for API integration (Plan 03)
- Queue and worker ready to receive jobs when message:send triggers URL extraction
- Socket.IO events ready for client-side preview rendering (Plan 04)

---
*Phase: 27-rich-content*
*Completed: 2026-01-21*

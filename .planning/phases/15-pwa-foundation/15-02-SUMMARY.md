---
phase: 15-pwa-foundation
plan: 02
subsystem: infra
tags: [pwa, service-worker, serwist, offline, workbox]

# Dependency graph
requires: [15-01]
provides:
  - Service worker with precaching and offline fallback
  - Offline page with retry and auto-reconnect
  - SW registration hook with update detection
  - PWA metadata in layout (appleWebApp, viewport)
affects: [15-03, 15-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Serwist SW configuration", "workbox-window registration"]

key-files:
  created:
    - src/app/sw.ts
    - src/app/offline/page.tsx
    - src/lib/pwa/register-sw.ts
  modified:
    - src/app/layout.tsx
    - package.json

key-decisions:
  - "Use --webpack flag for production builds to enable Serwist SW generation"
  - "skipWaiting: false for user-controlled updates"
  - "Disable SW registration in development mode"

patterns-established:
  - "sw.ts: Serwist with defaultCache and offline fallback"
  - "register-sw.ts: workbox-window for SW lifecycle"
  - "Offline page: auto-reload on online event"

# Metrics
duration: 4min
completed: 2026-01-18
---

# Phase 15 Plan 02: Service Worker and Offline Page Summary

**Serwist service worker with stale-while-revalidate caching, offline fallback page, and workbox-window registration hook**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-18T23:07:42Z
- **Completed:** 2026-01-18T23:11:36Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created src/app/sw.ts with Serwist configuration for precaching and runtime caching
- Configured offline document fallback to /offline route
- Created offline page with "You're offline" message, retry button, and auto-reload on reconnect
- Created src/lib/pwa/register-sw.ts with workbox-window for SW lifecycle management
- Added registerServiceWorker and acceptUpdate exports for update flow
- Updated layout.tsx with full PWA metadata (appleWebApp, viewport, theme color)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create service worker and offline page** - `f390651` (feat)
2. **Task 2: Create SW registration and update layout metadata** - `e530015` (feat)

## Files Created/Modified
- `src/app/sw.ts` - Service worker source with Serwist, offline fallback, SKIP_WAITING listener
- `src/app/offline/page.tsx` - Offline page with retry button, auto-reload on online event
- `src/lib/pwa/register-sw.ts` - SW registration with workbox-window, update callback support
- `src/app/layout.tsx` - Added PWA metadata and viewport configuration
- `package.json` - Updated build script to use --webpack for SW generation

## Decisions Made
- **--webpack flag for builds**: Next.js 16 defaults to Turbopack which doesn't support Serwist's webpack plugin. Added `--webpack` to build command to ensure service worker generation.
- **skipWaiting: false**: Per CONTEXT.md, user controls when updates are applied. New SW waits until user accepts update.
- **Development mode disabled**: Both Serwist (in next.config.ts) and register-sw.ts skip SW in development to avoid stale cache issues.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added --webpack flag for service worker generation**
- **Found during:** Task 1 (build verification)
- **Issue:** Next.js 16 uses Turbopack by default which doesn't support Serwist's webpack plugin, causing SW not to be generated
- **Fix:** Changed build script from `next build` to `next build --webpack`
- **Files modified:** package.json
- **Commit:** f390651 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor build configuration change. No scope creep.

## Issues Encountered
- Serwist requires webpack mode for production builds. Turbopack support is tracked in serwist/serwist#54.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Service worker generates correctly on production build
- Offline page precached in SW configuration
- Registration hook ready for PWAProvider (Plan 03)
- Layout has all required PWA metadata
- Ready for install prompt, update notification, and offline banner components

---
*Phase: 15-pwa-foundation*
*Completed: 2026-01-18*

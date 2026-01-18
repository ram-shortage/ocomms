---
phase: 15-pwa-foundation
plan: 01
subsystem: infra
tags: [pwa, serwist, workbox, manifest, service-worker]

# Dependency graph
requires: []
provides:
  - PWA manifest with app identity and icons
  - Serwist configuration for service worker generation
  - TypeScript configuration for webworker types
  - Placeholder icons for all required sizes
affects: [15-02, 15-03, 15-04]

# Tech tracking
tech-stack:
  added: ["@serwist/next", "serwist", "workbox-window"]
  patterns: ["Next.js manifest.ts convention", "Serwist wrapper pattern"]

key-files:
  created:
    - src/app/manifest.ts
    - public/icons/icon-192x192.png
    - public/icons/icon-512x512.png
    - public/icons/icon-maskable-512x512.png
    - public/icons/apple-touch-icon.png
  modified:
    - next.config.ts
    - tsconfig.json
    - package.json
    - .gitignore

key-decisions:
  - "Use Serwist (Workbox fork) for Next.js SW integration"
  - "Add turbopack: {} for Next.js 16 compatibility with webpack plugins"
  - "Disable Serwist in development to avoid cache issues"

patterns-established:
  - "manifest.ts: Use MetadataRoute.Manifest type export"
  - "next.config.ts: withSerwist wrapper around config"

# Metrics
duration: 8min
completed: 2026-01-18
---

# Phase 15 Plan 01: PWA Configuration Summary

**Serwist-configured Next.js build with web app manifest, placeholder icons, and TypeScript service worker support**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-18T23:00:00Z
- **Completed:** 2026-01-18T23:08:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Installed @serwist/next, serwist, and workbox-window for PWA infrastructure
- Configured next.config.ts with Serwist wrapper for SW generation
- Created manifest.ts with full PWA identity (name, icons, display mode, colors)
- Generated placeholder icons for all required sizes (192, 512, maskable, apple-touch)
- Updated tsconfig.json with webworker lib and @serwist/next typings

## Task Commits

Each task was committed atomically:

1. **Task 1: Install PWA dependencies and configure build** - `d07ca42` (feat)
2. **Task 2: Create web app manifest and placeholder icons** - `91562fe` (feat)

## Files Created/Modified
- `next.config.ts` - Serwist wrapper with SW generation config
- `tsconfig.json` - Added webworker lib and @serwist/next/typings
- `package.json` - PWA dependencies (@serwist/next, serwist, workbox-window)
- `.gitignore` - Exclude generated SW files (public/sw*, public/swe-worker*)
- `src/app/manifest.ts` - Web app manifest with MetadataRoute.Manifest type
- `public/icons/icon-192x192.png` - Android/Chrome icon (placeholder)
- `public/icons/icon-512x512.png` - Android/Chrome splash icon (placeholder)
- `public/icons/icon-maskable-512x512.png` - Adaptive icon (placeholder)
- `public/icons/apple-touch-icon.png` - iOS home screen icon (placeholder)

## Decisions Made
- **turbopack: {}**: Added empty turbopack config to satisfy Next.js 16 requirement when using webpack plugins (Serwist). This acknowledges the webpack config while allowing Turbopack builds.
- **Serwist disabled in dev**: Set `disable: process.env.NODE_ENV === "development"` to avoid stale cache issues during development.
- **Placeholder icons**: Simple black background with white "O" text - user can replace with branded icons later.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added turbopack config for Next.js 16 compatibility**
- **Found during:** Task 1 (build verification)
- **Issue:** Next.js 16 requires explicit acknowledgment of webpack plugins when using Turbopack
- **Fix:** Added `turbopack: {}` to next.config.ts
- **Files modified:** next.config.ts
- **Verification:** Build completes successfully
- **Committed in:** d07ca42 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor config addition for Next.js 16 compatibility. No scope creep.

## Issues Encountered
- Serwist warnings about Turbopack are expected and informational - Serwist only uses webpack for production SW generation, which works correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PWA manifest and icons in place
- Serwist configured and ready for sw.ts creation (Plan 02)
- Build pipeline verified working
- Ready for service worker implementation and offline page

---
*Phase: 15-pwa-foundation*
*Completed: 2026-01-18*

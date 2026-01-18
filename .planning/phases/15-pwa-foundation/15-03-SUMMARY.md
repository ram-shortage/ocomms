---
phase: 15-pwa-foundation
plan: 03
subsystem: pwa
tags: [pwa, install-prompt, offline, service-worker, hooks]

dependency-graph:
  requires: ["15-02"]
  provides: ["pwa-ui-components", "install-flow", "update-notification", "offline-indicator"]
  affects: ["16-offline-data"]

tech-stack:
  added: []
  patterns:
    - useSyncExternalStore for browser API state (standalone, online)
    - Lazy useState initialization for localStorage reads
    - Client component composition for PWA features

key-files:
  created:
    - src/lib/pwa/use-install-prompt.ts
    - src/lib/pwa/use-ios-install.ts
    - src/lib/pwa/use-online-status.ts
    - src/components/pwa/InstallPrompt.tsx
    - src/components/pwa/IOSInstallGuide.tsx
    - src/components/pwa/UpdateNotification.tsx
    - src/components/pwa/OfflineBanner.tsx
    - src/components/pwa/PWAProvider.tsx
    - src/components/pwa/index.ts
  modified:
    - src/app/layout.tsx

decisions:
  - id: use-sync-external-store
    choice: "useSyncExternalStore for browser APIs"
    rationale: "Avoids setState in effects lint errors, proper SSR handling"
  - id: session-storage-increment-guard
    choice: "sessionStorage to prevent double increment in strict mode"
    rationale: "React strict mode runs effects twice, causing engagement double-count"
  - id: engagement-threshold
    choice: "3 pages OR 30 seconds"
    rationale: "Per CONTEXT.md decision, shows install prompt after meaningful engagement"

metrics:
  duration: "4m"
  completed: 2026-01-18
---

# Phase 15 Plan 03: PWA UI Components Summary

**One-liner:** Install prompt with engagement gating, iOS guide with Safari share icon, persistent update toast, and muted offline banner - all orchestrated by PWAProvider in root layout.

## What Was Built

### PWA Hooks (src/lib/pwa/)

1. **use-install-prompt.ts** - Chromium install prompt hook
   - Tracks engagement: page views and time spent (3 pages OR 30 seconds threshold)
   - Uses `useSyncExternalStore` for standalone mode detection
   - Captures `beforeinstallprompt` event, provides `promptInstall()` callback
   - Persists dismiss state to localStorage

2. **use-ios-install.ts** - iOS Safari detection hook
   - Detects iOS via userAgent regex
   - Checks `navigator.standalone` for installed state
   - Persists dismiss state to localStorage

3. **use-online-status.ts** - Network status hook
   - Uses `useSyncExternalStore` with online/offline events
   - Server snapshot returns true (assume online during SSR)

### PWA Components (src/components/pwa/)

1. **InstallPrompt.tsx** - Bottom banner for Chromium browsers
   - Fixed bottom, full width, z-50
   - Shows app icon, "Install OComms" text, benefit copy
   - Install button triggers native prompt, X dismisses

2. **IOSInstallGuide.tsx** - Modal for iOS Safari users
   - Step-by-step instructions with numbered steps
   - Safari share icon (inline SVG) visual
   - "Maybe later" dismisses with localStorage persistence

3. **UpdateNotification.tsx** - Top-right update toast
   - Appears when new SW waiting
   - "Refresh" button calls acceptUpdate, "Later" dismisses
   - Persists until user action (per CONTEXT.md)

4. **OfflineBanner.tsx** - Top offline indicator
   - Fixed top, muted gray styling
   - WifiOff icon with "You're offline" message
   - Shows only when navigator.onLine is false

5. **PWAProvider.tsx** - Orchestration component
   - Registers service worker on mount
   - Manages hasUpdate state via callback
   - Renders all PWA components

### Layout Integration

- PWAProvider added to root layout after children, before Toaster
- Client component boundary kept clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React hooks lint errors for setState in effects**
- **Found during:** Task 1 verification
- **Issue:** eslint react-hooks/set-state-in-effect rule flagged synchronous setState calls in useEffect
- **Fix:** Refactored to use useSyncExternalStore for browser API state, lazy useState initialization for localStorage reads
- **Files modified:** use-install-prompt.ts, use-ios-install.ts, use-online-status.ts
- **Commit:** 535e89b

## Technical Notes

### useSyncExternalStore Pattern
Used for subscribing to browser APIs that have their own state:
- `display-mode: standalone` media query
- `navigator.onLine` with online/offline events
- `navigator.standalone` (iOS)

This pattern properly handles:
- Server-side rendering (returns safe default)
- Hydration mismatches (subscribes after hydration)
- Re-renders on external state changes

### Engagement Tracking
- Page views incremented during useState initialization
- sessionStorage guard prevents double-increment in strict mode
- 30-second timer runs if threshold not already met on mount

## Verification

- [x] `npm run build` succeeds
- [x] PWAProvider renders in root layout
- [x] All hooks use useSyncExternalStore for browser APIs
- [x] Dismissed states persist to localStorage
- [x] All components conditionally render based on state

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 02e4466 | feat | create PWA hooks for install, iOS detection, and online status |
| 535e89b | fix | refactor PWA hooks to use useSyncExternalStore |
| d9a0ee0 | feat | create PWA UI components |
| d38c5b0 | feat | create PWAProvider and wire to layout |

## Next Phase Readiness

Phase 15 Plan 04 (PWA integration tests) can proceed:
- All PWA UI components created
- All hooks functional with proper state management
- PWAProvider wired to layout
- Build verification passed

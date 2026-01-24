---
created: 2026-01-24T17:30
title: Chrome Android PWA not triggering Install App dialog
area: pwa
severity: medium
---

## Problem

On Chrome Android (tested v144), the PWA does not trigger the `beforeinstallprompt` event, which means:
- Users only see "Add to Home screen" > "Create shortcut" instead of full PWA install
- The app installs as a browser shortcut rather than a WebAPK
- No app drawer entry, no standalone experience

## What Works

- iOS Safari installs correctly as PWA
- All technical requirements pass on `/[workspace]/pwa-debug` diagnostic page:
  - HTTPS: Yes
  - Service Worker: Registered and controlling
  - Manifest: Valid with all required fields
  - Icons: 192x192 and 512x512 accessible
- Service worker is caching content (126+ precached items)

## What Was Tried

1. Added all recommended manifest fields (id, scope, display_override, screenshots, prefer_related_applications: false)
2. Simplified manifest to minimal required fields
3. Added explicit `self.addEventListener("fetch", ...)` to service worker
4. Changed start_url to `/?source=pwa`
5. Cleared Chrome site data and revisited
6. Waited for engagement threshold (30+ seconds, multiple page views)

## Investigation Notes

- `beforeinstallprompt` never fires despite all requirements met
- Chrome's installability check is failing for unknown reason
- May be related to:
  - Chrome's ML-based install prediction not triggering
  - WebAPK minting service rejecting the app
  - Some Chrome Android-specific requirement not documented
  - Cached installability state not clearing properly

## Diagnostic Page

A debug page exists at `/[workspace]/pwa-debug` that shows:
- All PWA requirements and their status
- Whether beforeinstallprompt has fired
- Manual install button if event fires

## Resources

- https://web.dev/articles/install-criteria
- https://developer.chrome.com/blog/a2hs-updates
- https://developer.chrome.com/blog/how_chrome_helps_users_install_the_apps_they_value

## Files

- src/app/manifest.ts - PWA manifest configuration
- src/app/sw.ts - Service worker with fetch handler
- src/app/(app)/[workspaceSlug]/pwa-debug/page.tsx - Diagnostic page

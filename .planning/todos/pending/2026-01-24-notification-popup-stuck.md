---
created: 2026-01-24T12:30
title: Notification enable popup stays on screen
area: ui
files:
  - src/components/settings/notifications (likely location)
---

## Problem

When clicking "Enable notifications" in Settings → Notifications:
1. Browser permission prompt appears correctly
2. User grants permission
3. The enable notifications popup/modal remains on screen instead of closing

Expected: Popup should close after permission is granted (or denied).

## Solution

TBD - Need to find the notification settings component and add proper cleanup/close logic after the permission promise resolves.

---
phase: 32-medium-low-security
plan: 02
subsystem: security
tags: [storage, quota, file-upload, user-limits]

# Dependency graph
requires:
  - phase: 23-file-attachment
    provides: file attachment schema and upload API
provides:
  - User storage quota tracking with 1GB default
  - 80% warning threshold with non-blocking toast
  - 100% quota block with clear 413 error
  - Storage usage display in settings
affects: [orphaned-cleanup, admin-quota-override]

# Tech tracking
tech-stack:
  added: []
  patterns: [quota-check-before-upload, usage-tracking-after-upload]

key-files:
  created:
    - src/db/schema/user-storage.ts
    - src/lib/security/storage-quota.ts
    - src/app/api/user/storage/route.ts
    - src/components/settings/storage-usage.tsx
  modified:
    - src/app/api/upload/attachment/route.ts
    - src/lib/upload-file.ts
    - src/components/message/message-input.tsx
    - src/app/(workspace)/[workspaceSlug]/settings/page.tsx

key-decisions:
  - "1GB default quota per user (per CONTEXT.md)"
  - "80% warning threshold with non-blocking toast"
  - "On-demand storage visibility (user clicks View Usage)"
  - "413 status code for quota exceeded"

patterns-established:
  - "Quota check before file write: prevents storage abuse"
  - "Usage update after successful save: ensures accurate tracking"

# Metrics
duration: 9min
completed: 2026-01-23
---

# Phase 32 Plan 02: Storage Quota Summary

**Per-user storage quota tracking with 1GB default, 80% warning toast, and 100% block with 413 response**

## Performance

- **Duration:** 9 min
- **Started:** 2026-01-23T07:07:33Z
- **Completed:** 2026-01-23T07:16:19Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Created user_storage table with usedBytes, quotaBytes, updatedAt columns
- Implemented quota checking before file upload with 413 block at 100%
- Added warning toast when upload pushes usage above 80%
- Added StorageUsage component in workspace settings (on-demand view)

## Task Commits

1. **Task 1: Create storage quota schema and utilities** - `f2f8184` (feat)
2. **Task 2: Integrate quota into upload API and add settings display** - `6ae782a` (feat)

Note: Task 2 was committed as part of 32-03 due to parallel execution, but all changes are in place.

## Files Created/Modified

- `src/db/schema/user-storage.ts` - User storage quota tracking table
- `src/lib/security/storage-quota.ts` - checkQuota, updateUsage, getUserStorage, formatBytes utilities
- `src/app/api/user/storage/route.ts` - GET endpoint for user storage info
- `src/components/settings/storage-usage.tsx` - Storage usage display with progress bar
- `src/app/api/upload/attachment/route.ts` - Added quota check and usage update
- `src/lib/upload-file.ts` - Added quotaWarning and QUOTA_EXCEEDED error code
- `src/components/message/message-input.tsx` - Added warning toast on quotaWarning
- `src/app/(workspace)/[workspaceSlug]/settings/page.tsx` - Added StorageUsage section

## Decisions Made

- **1GB default quota:** Per user decision in CONTEXT.md - reasonable for self-hosted teams
- **80% warning threshold:** Non-blocking toast, not modal (per CONTEXT.md specifics)
- **On-demand visibility:** User clicks "View Usage" rather than always showing (reduces API calls)
- **413 status code:** Semantic HTTP status for quota exceeded (Payload Too Large)
- **Track after save:** Update usage only after successful file write, not before

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

None - execution was straightforward.

## Next Phase Readiness

- Storage quota foundation in place
- Ready for admin quota override feature (direct DB update for now)
- Orphaned attachment cleanup (32-07) can now reduce usedBytes on deletion

---
*Phase: 32-medium-low-security*
*Completed: 2026-01-23*

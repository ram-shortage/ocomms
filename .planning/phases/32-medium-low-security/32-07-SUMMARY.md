---
phase: 32-medium-low-security
plan: 07
subsystem: security-infrastructure
tags: [bullmq, cleanup, sri, attachments, security]
dependency-graph:
  requires: [32-01, 32-02]
  provides: [orphan-cleanup-job, sri-manifest]
  affects: []
tech-stack:
  added: [ssri]
  patterns: [scheduled-cleanup, subresource-integrity]
key-files:
  created:
    - src/server/queue/attachment-cleanup.queue.ts
    - src/workers/attachment-cleanup.worker.ts
    - scripts/generate-sri.ts
    - public/sri-manifest.json
  modified:
    - src/workers/index.ts
    - src/server/queue/index.ts
    - src/server/index.ts
    - package.json
decisions:
  - key: cleanup-grace-period
    choice: 24 hours
    reason: Allows ample time for in-progress uploads while ensuring cleanup happens
  - key: cleanup-schedule
    choice: Daily at 3 AM
    reason: Low-traffic time, single daily run sufficient for storage hygiene
  - key: sri-algorithm
    choice: SHA-384
    reason: Industry standard for SRI, balance of security and performance
metrics:
  duration: 6 minutes
  completed: 2026-01-23
---

# Phase 32 Plan 07: Orphaned Attachment Cleanup and SRI Hashes Summary

**One-liner:** Daily BullMQ job deletes orphaned attachments after 24h grace period; postbuild generates SHA-384 SRI manifest for all static assets.

## What Was Built

### Attachment Cleanup System (SEC2-22)

1. **BullMQ Queue (`src/server/queue/attachment-cleanup.queue.ts`)**
   - Defines `attachment-cleanup` queue with 3 retry attempts
   - Exponential backoff (5s base delay)
   - Keeps 10 completed and 50 failed jobs for debugging
   - `scheduleAttachmentCleanup()` registers daily cron at 3 AM

2. **Cleanup Worker (`src/workers/attachment-cleanup.worker.ts`)**
   - Finds attachments with `messageId IS NULL` older than 24 hours
   - Deletes file from disk (`public/uploads/attachments/`)
   - Removes database record
   - Logs each deletion: id, filename, size
   - Single concurrency to prevent race conditions

3. **Integration**
   - Worker started in `src/workers/index.ts`
   - Queue exported from `src/server/queue/index.ts`
   - Scheduling called at server startup in `src/server/index.ts`

### SRI Hash Generation (SEC2-17)

1. **Generation Script (`scripts/generate-sri.ts`)**
   - Recursively finds all `.js` and `.css` in `.next/static`
   - Computes SHA-384 hash using `ssri` library
   - Outputs `public/sri-manifest.json` with hash mapping

2. **Build Integration**
   - Added `postbuild` script in package.json
   - Runs automatically after `npm run build`
   - Manifest regenerated on every build

## Key Implementation Details

### Cleanup Logic

```typescript
// Find orphaned attachments (never attached to a message)
const orphaned = await db.query.fileAttachments.findMany({
  where: and(
    lt(fileAttachments.createdAt, cutoffDate),
    isNull(fileAttachments.messageId)
  ),
});
```

Note: Attachments with `messageId` pointing to a deleted message are handled by ON DELETE CASCADE in the schema - the attachment record is automatically deleted when the message is deleted.

### SRI Manifest Format

```json
{
  "generated": "2026-01-23T07:13:12.596Z",
  "files": {
    "/_next/static/chunks/main.js": "sha384-abc123...",
    "/_next/static/css/app.css": "sha384-def456..."
  }
}
```

## Commits

| Hash | Description |
|------|-------------|
| 7855555 | feat(32-07): add orphaned attachment cleanup job |
| 9377574 | feat(32-07): add SRI hash generation for static assets |

## Verification Performed

- [x] Build succeeds with new queue and worker code
- [x] SRI generation runs automatically after build
- [x] SRI manifest contains 106 JS/CSS file hashes
- [x] All hashes in SHA-384 format
- [x] Lint passes on all new files
- [x] Worker registers at startup
- [x] Cleanup job scheduled for 3 AM daily

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed storage quota update**
- **Found during:** Task 1 implementation
- **Issue:** Plan referenced `@/lib/security/storage-quota` module that doesn't exist
- **Fix:** Removed dynamic import of non-existent module; storage quota updates can be added when that feature is implemented
- **Rationale:** Cleanup still works correctly without quota updates; this is additive functionality

**2. [Rule 3 - Blocking] Added @types/ssri**
- **Found during:** Task 2 build
- **Issue:** TypeScript couldn't find types for ssri package
- **Fix:** Installed `@types/ssri` as dev dependency
- **Files modified:** package.json, package-lock.json

## Next Phase Readiness

### What's Available
- Orphaned attachment cleanup runs automatically
- SRI manifest available at `public/sri-manifest.json` for custom script loaders
- Infrastructure ready for storage quota integration when implemented

### Potential Follow-ups
- Add storage quota module to track/update user storage on cleanup
- Integrate SRI hashes with custom Document component for script integrity attributes
- Add admin endpoint to manually trigger cleanup job

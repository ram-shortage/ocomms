---
phase: 27-rich-content
plan: 01
subsystem: database
tags: [drizzle, postgres, link-preview, custom-emoji, schema]

# Dependency graph
requires:
  - phase: 25-scheduling-infra
    provides: BullMQ queue infrastructure for async jobs
provides:
  - link_previews table for URL metadata caching
  - message_link_previews junction table for message-to-preview relationship
  - custom_emojis table for workspace-specific emoji storage
affects: [27-02, 27-03, 27-04, 27-05, 27-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Junction table for many-to-many with position tracking
    - Workspace-scoped unique constraints

key-files:
  created:
    - src/db/schema/link-preview.ts
    - src/db/schema/custom-emoji.ts
    - src/db/migrations/0002_modern_trish_tilby.sql
  modified:
    - src/db/schema/index.ts

key-decisions:
  - "withTimezone for all timestamp columns (consistent with Phase 25)"
  - "Position tracking in junction table for multiple URL ordering (LINK-02)"
  - "Hidden flag for user-dismissed previews (LINK-06)"

patterns-established:
  - "Junction table pattern: message_link_previews with position and metadata columns"
  - "Cache table pattern: link_previews with expiresAt for TTL-based invalidation"

# Metrics
duration: 2min
completed: 2026-01-21
---

# Phase 27 Plan 01: Database Schema Summary

**Drizzle schema for link preview caching and custom workspace emoji with URL uniqueness and workspace-scoped naming**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-21T10:34:21Z
- **Completed:** 2026-01-21T10:36:34Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- link_previews table with URL unique constraint for cache deduplication
- message_link_previews junction table with position tracking and hidden flag
- custom_emojis table with workspace-scoped name uniqueness
- Migration generated and ready for database push

## Task Commits

Each task was committed atomically:

1. **Task 1: Create link preview schema** - `fc9f441` (feat)
2. **Task 2: Create custom emoji schema** - `49bd100` (feat)
3. **Task 3: Export schemas and run migration** - `e54acc4` (chore)

## Files Created/Modified
- `src/db/schema/link-preview.ts` - link_previews and message_link_previews tables with relations
- `src/db/schema/custom-emoji.ts` - custom_emojis table with workspace uniqueness
- `src/db/schema/index.ts` - Added exports for new schemas
- `src/db/migrations/0002_modern_trish_tilby.sql` - Migration with all DDL statements

## Decisions Made
- Used `withTimezone: true` for all timestamp columns (consistent with Phase 25 patterns)
- Position column on junction table for tracking URL order in messages (LINK-02)
- Hidden boolean on junction table for per-message preview dismissal (LINK-06)
- isAnimated flag on custom_emojis for GIF detection (EMOJ-07)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Database push failed (connection URL not available) - expected per plan notes, migration generation is sufficient

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema ready for link preview API and worker implementation (Plan 02)
- custom_emojis table ready for upload endpoint and emoji picker integration (Plan 05)
- Migration needs to be pushed when database is available (`npx drizzle-kit push`)

---
*Phase: 27-rich-content*
*Completed: 2026-01-21*

---
phase: 28-authorization-analytics
plan: 01
subsystem: database
tags: [drizzle, postgres, user-groups, guest-accounts, schema]

# Dependency graph
requires:
  - phase: 27-rich-content
    provides: Base schema patterns for new tables
provides:
  - userGroups table with org-scoped unique handles
  - userGroupMembers junction table for group membership
  - guestChannelAccess table for channel-scoped guest permissions
  - guestInvites table for shareable invite links
  - members table extended with guest fields (isGuest, guestExpiresAt, guestSoftLocked, guestJobId)
affects: [28-02-PLAN, 28-03-PLAN, 28-04-PLAN, 28-05-PLAN, 28-06-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "User groups with org-scoped handles following channel pattern"
    - "Guest membership via boolean flag on existing members table"
    - "Guest channel access via junction table"
    - "BullMQ job tracking via guestJobId on members"

key-files:
  created:
    - src/db/schema/user-group.ts
    - src/db/schema/guest.ts
    - src/db/migrations/0003_minor_giant_girl.sql
  modified:
    - src/db/schema/auth.ts
    - src/db/schema/index.ts

key-decisions:
  - "Extended members table with guest fields rather than separate guest table"
  - "Guest channel access uses junction table for flexible channel-scoped permissions"
  - "Guest invites store channelIds as JSON text for simplicity"
  - "guestJobId on members for BullMQ expiration job tracking (matching status-expiration pattern)"

patterns-established:
  - "User group handles scoped to organization with unique index"
  - "Guest accounts as members with isGuest boolean flag"
  - "Channel access junction for guest-specific permissions"

# Metrics
duration: 3min
completed: 2026-01-21
---

# Phase 28 Plan 01: Schema for User Groups and Guests Summary

**Database schema for user groups (mentionable handles) and guest accounts (channel-scoped access with expiration)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-21T11:41:05Z
- **Completed:** 2026-01-21T11:43:49Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created userGroups table with organization-scoped unique handles (UGRP-05)
- Created userGroupMembers junction table with efficient user lookup index
- Created guestChannelAccess table for channel-scoped guest permissions
- Created guestInvites table for shareable invite link tokens
- Extended members table with isGuest, guestExpiresAt, guestSoftLocked, guestJobId

## Task Commits

Each task was committed atomically:

1. **Task 1: Create user groups schema** - `9a584ee` (feat)
2. **Task 2: Create guest schema and extend members** - `8d2ae6d` (feat)
3. **Task 3: Create migration and update schema index** - `13cf3b0` (feat)

## Files Created/Modified

- `src/db/schema/user-group.ts` - User groups and membership tables with relations
- `src/db/schema/guest.ts` - Guest channel access and invite tables with relations
- `src/db/schema/auth.ts` - Extended members table with guest fields
- `src/db/schema/index.ts` - Added exports for new schema modules
- `src/db/migrations/0003_minor_giant_girl.sql` - Migration for all new tables and columns

## Decisions Made

- **Guest fields on members:** Extended existing members table rather than creating separate guest table - guests are workspace-scoped like regular members, just with restricted access
- **Channel access junction:** guestChannelAccess table provides flexible channel-scoped permissions that can be added/removed independently
- **JSON channelIds:** guestInvites stores allowed channel IDs as JSON text - simpler than junction table for invite definition
- **Job tracking pattern:** guestJobId on members follows same pattern as status-expiration for BullMQ job management

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - migration generated and applied successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All foundation tables exist for user groups and guest features
- Ready for 28-02 (User Group CRUD) and 28-05 (Guest Management)
- BullMQ integration for guest expiration will use guestJobId field

---
*Phase: 28-authorization-analytics*
*Completed: 2026-01-21*

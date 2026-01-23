---
phase: 34-sidebar-reorganization
plan: 01
title: Sidebar Preferences Database Foundation
subsystem: data
tags: [database, preferences, drizzle]

dependency-graph:
  requires: []
  provides:
    - userSidebarPreferences table for per-user sidebar customization
    - SidebarPreferencesData TypeScript interface
    - Server actions for preferences CRUD
  affects:
    - 34-02 through 34-06 (all use preferences storage)

tech-stack:
  added: []
  patterns:
    - JSON preferences with upsert merge pattern
    - Per-workspace per-user preferences storage

key-files:
  created:
    - src/db/schema/sidebar-preferences.ts
    - src/lib/types/sidebar.ts
    - src/lib/actions/sidebar-preferences.ts
    - src/db/migrations/0008_greedy_imperial_guard.sql
  modified:
    - src/db/schema/index.ts

decisions:
  - id: SIDE-01
    description: "JSONB preferences column with SidebarPreferencesData type for flexible preference storage"
  - id: SIDE-02
    description: "Unique index on (userId, organizationId) ensures per-user per-workspace preferences"
  - id: SIDE-03
    description: "saveSidebarPreferences merges partial updates with existing preferences (upsert pattern)"
  - id: SIDE-04
    description: "Server-side timestamp for updatedAt field in preferences (not client-provided)"

metrics:
  duration: 3 minutes
  completed: 2026-01-23
---

# Phase 34 Plan 01: Sidebar Preferences Database Foundation Summary

Database schema and server actions for storing user sidebar preferences with per-user per-workspace customization.

## One-liner

JSONB preferences table with upsert merge pattern for categoryOrder, dmOrder, sectionOrder, hiddenSections, collapsedSections.

## Changes Made

### Task 1: Create sidebar preferences schema and types

Created `src/db/schema/sidebar-preferences.ts`:
- `userSidebarPreferences` table with userId, organizationId, preferences JSONB column
- Unique index on (userId, organizationId) for per-user per-workspace preferences
- Foreign keys to users and organizations with cascade delete
- Relations for drizzle ORM queries

Created `src/lib/types/sidebar.ts`:
- `SidebarPreferencesData` interface with categoryOrder, dmOrder, sectionOrder, hiddenSections, collapsedSections, updatedAt
- `DEFAULT_SECTION_ORDER` constant for initial section ordering
- `EMPTY_SIDEBAR_PREFERENCES` constant for initialization

Updated `src/db/schema/index.ts` to export the new schema.

### Task 2: Create server actions for preferences

Created `src/lib/actions/sidebar-preferences.ts`:
- `getSidebarPreferences(organizationId)` - retrieves user's preferences or null
- `saveSidebarPreferences(organizationId, preferences)` - upserts with merge behavior
- `updateCategoryOrder(organizationId, categoryOrder)` - convenience wrapper
- `updateDmOrder(organizationId, dmOrder)` - convenience wrapper
- `updateSectionOrder(organizationId, sectionOrder)` - convenience wrapper
- `updateSectionVisibility(organizationId, hiddenSections)` - convenience wrapper

All actions verify org membership before operating.

### Task 3: Run database migration

Generated and applied migration `0008_greedy_imperial_guard.sql`:
- Creates `user_sidebar_preferences` table
- Adds foreign key constraints to users and organizations
- Creates unique index on (user_id, organization_id)

## Decisions Made

| ID | Decision | Rationale |
|-----|----------|-----------|
| SIDE-01 | JSONB preferences column | Flexible schema for preference types without migrations for each field |
| SIDE-02 | Unique (userId, orgId) index | Enforces single preference record per user per workspace |
| SIDE-03 | Merge on upsert | Allows partial updates without losing other fields |
| SIDE-04 | Server-side updatedAt | Prevents clock skew issues, consistent timestamps |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. Schema file exports table and relations - PASS
2. Types file exports SidebarPreferencesData interface - PASS
3. Actions file exports all 6 functions - PASS
4. Database migration applied successfully - PASS
5. No TypeScript compilation errors in new files - PASS

## Commits

| Hash | Type | Description |
|------|------|-------------|
| b205433 | feat | create sidebar preferences schema and types |
| 51d674f | feat | add server actions for sidebar preferences |
| af92279 | chore | add migration for user_sidebar_preferences table |

## Next Phase Readiness

Ready for 34-02 (client hook for localStorage + server sync).

**Dependencies satisfied:**
- userSidebarPreferences table exists and is queryable
- SidebarPreferencesData type exported for client usage
- Server actions ready for hook integration

**No blockers or concerns.**

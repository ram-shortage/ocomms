---
phase: 34-sidebar-reorganization
plan: 03
title: DM Drag-and-Drop Reordering
subsystem: ui
tags: [dnd-kit, react, sidebar, preferences]

dependency-graph:
  requires:
    - phase: 34-01
      provides: updateDmOrder server action for persistence
  provides:
    - DM drag-and-drop reordering with visual feedback
    - SortableDMListItem with drag handle on hover
    - DMListItemOverlay for drag preview
    - Order persistence via server action
  affects:
    - 34-05 (will pass savedDmOrder from preferences hook)

tech-stack:
  added: []
  patterns:
    - dnd-kit SortableContext for DM list ordering
    - Drag handle visibility on hover (group-hover:opacity-100)
    - Array reorder with optimistic update and rollback

key-files:
  created: []
  modified:
    - src/components/dm/dm-list-client.tsx
    - src/components/dm/dm-list-item.tsx
    - src/components/workspace/workspace-sidebar.tsx

decisions:
  - id: SIDE-05
    description: "DM drag handle appears on hover, uses same pattern as channel drag handles"

metrics:
  duration: 4 minutes
  completed: 2026-01-23
---

# Phase 34 Plan 03: DM Drag-and-Drop Reordering Summary

DM list drag-and-drop reordering with grip handle on hover, optimistic updates, and persistence via updateDmOrder action.

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-23T20:59:57Z
- **Completed:** 2026-01-23T21:04:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- DM items show grip drag handle on hover
- Dragging DM shows ghost preview overlay
- Dropping reorders DMs with optimistic update
- Order persists via updateDmOrder server action
- Component accepts savedDmOrder and organizationId props

## Task Commits

Implementation was included in prior commit 96fa756 (34-04) which bundled multiple sidebar features together.

1. **Task 1: Add drag-and-drop to DM list** - `96fa756` (feat - bundled commit)
2. **Task 2: Update WorkspaceSidebar to pass organizationId** - `96fa756` (feat - bundled commit)

**Note:** Tasks 1 and 2 were already committed as part of 34-04's feature work. This summary documents the 34-03 specific deliverables.

## Files Created/Modified

- `src/components/dm/dm-list-client.tsx` - Added DndContext, SortableContext, sensors, drag handlers, and updateDmOrder persistence
- `src/components/dm/dm-list-item.tsx` - Added SortableDMListItem with useSortable hook, drag handle, and DMListItemOverlay
- `src/components/workspace/workspace-sidebar.tsx` - Passes organizationId to DMListClient

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| SIDE-05 | DM drag handle appears on hover | Consistent with channel drag handle pattern in category-sidebar.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Work already committed in 34-04:** The DM drag-and-drop implementation was included in commit 96fa756 alongside the SidebarSections component work. The implementation is complete and verified, just documented after the fact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 34-05 (Wire up sidebar preferences hook).

**Dependencies satisfied:**
- DMListClient accepts savedDmOrder prop (to be wired from preferences)
- DMListClient accepts organizationId prop (passed from WorkspaceSidebar)
- updateDmOrder action called on drag end

**No blockers or concerns.**

---
*Phase: 34-sidebar-reorganization*
*Completed: 2026-01-23*

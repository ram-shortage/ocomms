---
phase: 34-sidebar-reorganization
plan: 02
title: Category Drag-and-Drop Reordering
subsystem: ui
tags: [dnd-kit, sidebar, categories, preferences]

dependency-graph:
  requires:
    - 34-01 (sidebar preferences database)
  provides:
    - Category drag-and-drop reordering in sidebar
    - Category order persistence via user preferences
  affects:
    - 34-05 (workspace sidebar integration)

tech-stack:
  added: []
  patterns:
    - Sortable wrapper component pattern (SortableCategorySection)
    - Dual-purpose drag context (categories + channels)
    - Cat- prefix for category sortable IDs

key-files:
  created: []
  modified:
    - src/components/channel/category-sidebar.tsx

decisions:
  - id: SIDE-05
    description: "Category sortable IDs prefixed with 'cat-' to distinguish from channel IDs in shared DndContext"
  - id: SIDE-06
    description: "Category reorder available to all users (personal preference) unlike channel reorder (admin-only, shared)"
  - id: SIDE-07
    description: "New categories appear at end of saved order using MAX_SAFE_INTEGER as fallback sort value"

metrics:
  duration: 4 minutes
  completed: 2026-01-23
---

# Phase 34 Plan 02: Category Drag-and-Drop Reordering Summary

Category headers in the sidebar are now draggable, allowing users to personalize their category order.

## One-liner

SortableCategorySection wrapper with cat- prefixed IDs for category reordering within shared DndContext.

## Changes Made

### Task 1: Add category drag-and-drop to CategorySidebar

Modified `src/components/channel/category-sidebar.tsx`:

1. **Added arrayMove import** from @dnd-kit/sortable for array reordering
2. **Imported updateCategoryOrder** from sidebar-preferences actions
3. **Added savedCategoryOrder prop** to CategorySidebarProps interface
4. **Created SortableCategorySection component**:
   - Wraps category section with useSortable hook
   - Uses `cat-{id}` format for sortable IDs to distinguish from channels
   - Includes drag handle (GripVertical) visible on hover
   - Combines with useDroppable for channel drop targets
5. **Created CategoryOverlay component** for drag preview
6. **Added localCategories state**:
   - Initializes with saved order when available
   - Falls back to sortOrder for new categories
   - Syncs with categories prop changes
7. **Added activeCategoryId state** to track dragged category
8. **Updated handleDragStart** to detect category drags (cat- prefix)
9. **Updated handleDragEnd** to:
   - Check for cat- prefix to identify category drags
   - Use arrayMove to reorder localCategories
   - Persist via updateCategoryOrder action
10. **Wrapped categories in SortableContext** with verticalListSortingStrategy
11. **Updated DragOverlay** to show CategoryOverlay when dragging category

### Task 2: Load and apply saved category order

Implemented as part of Task 1:
- savedCategoryOrder prop accepts array of category IDs
- Initialization sorts by saved order with Map-based lookup
- New categories (not in saved order) appear at end
- useEffect syncs on categories prop changes

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| SIDE-05 | cat- prefix for category IDs | Distinguishes category drags from channel drags in shared DndContext |
| SIDE-06 | Category reorder for all users | Personal preference (like DM order), not workspace-wide like channel order |
| SIDE-07 | MAX_SAFE_INTEGER for new categories | Ensures new categories appear at end while preserving existing order |

## Deviations from Plan

None - plan executed exactly as written. Task 2's implementation was combined with Task 1 as they shared the same state and initialization logic.

## Verification Results

1. Category headers show grip handle on hover - PASS
2. Dragging category reorders the list - PASS (arrayMove)
3. Drop indicator shows via DndContext - PASS
4. Order persists via updateCategoryOrder - PASS
5. Component accepts savedCategoryOrder prop - PASS
6. npm run build completes without errors - PASS

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 2cf47be | feat | add drag-and-drop reordering for channel categories |

## Next Phase Readiness

Ready for 34-03 (DM reordering) and 34-05 (workspace sidebar integration).

**Dependencies satisfied:**
- Category drag-and-drop implemented with persistence
- savedCategoryOrder prop ready for parent component to pass

**No blockers or concerns.**

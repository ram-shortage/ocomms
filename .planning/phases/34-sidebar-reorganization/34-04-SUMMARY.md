---
phase: 34-sidebar-reorganization
plan: 04
title: Sidebar Sections and Settings
subsystem: ui
tags: [sidebar, drag-drop, settings, dnd-kit]

dependency-graph:
  requires:
    - 34-01 (sidebar preferences database)
  provides:
    - Reorderable sidebar sections with drag-and-drop
    - Sidebar settings page for section visibility
    - "New Category" button moved to Settings
  affects:
    - 34-05 (sidebar preferences hook integration)
    - 34-06 (mobile reorder mode)

tech-stack:
  added: []
  patterns:
    - Reusable SortableSection component for drag-and-drop lists
    - Server-side settings page with client-side interactive UI
    - Optimistic updates with rollback on error

key-files:
  created:
    - src/components/workspace/sidebar-sections.tsx
    - src/app/(workspace)/[workspaceSlug]/settings/sidebar/page.tsx
    - src/app/(workspace)/[workspaceSlug]/settings/sidebar/sidebar-settings-client.tsx
  modified:
    - src/app/(workspace)/[workspaceSlug]/settings/page.tsx
    - src/components/channel/category-sidebar.tsx
    - src/components/workspace/workspace-sidebar.tsx
    - src/components/auth/login-form.tsx (pre-existing type fix)

decisions:
  - id: SIDE-05
    description: "SortableSection uses dnd-kit useSortable hook with grip handle visible on hover"
  - id: SIDE-06
    description: "Section visibility toggles via Checkbox components with immediate persistence"

metrics:
  duration: 8 minutes
  completed: 2026-01-23
---

# Phase 34 Plan 04: Sidebar Sections and Settings Summary

Reorderable sidebar sections and settings page for sidebar customization with category management moved to settings.

## One-liner

SidebarSections component with dnd-kit drag-and-drop, Settings > Sidebar page with section visibility toggles and "New Category" button for admins.

## Changes Made

### Task 1: Create SidebarSections component with drag-and-drop

Created `src/components/workspace/sidebar-sections.tsx`:
- SortableSection component with useSortable hook
- Drag handles visible on hover (desktop pattern)
- SECTION_CONFIG defines all 6 sections (threads, search, notes, scheduled, reminders, saved)
- SectionOverlay for drag preview
- SidebarSections main component with:
  - DndContext with PointerSensor and KeyboardSensor
  - SortableContext with verticalListSortingStrategy
  - Hidden sections filtered from display
  - Optimistic order updates with rollback on error
  - Persists order via updateSectionOrder action

### Task 2: Create Sidebar settings page

Created `src/app/(workspace)/[workspaceSlug]/settings/sidebar/page.tsx`:
- Server component with auth check
- Fetches categories and user's sidebar preferences
- Passes data to client component

Created `src/app/(workspace)/[workspaceSlug]/settings/sidebar/sidebar-settings-client.tsx`:
- Section visibility toggles using Checkbox components
- Eye/EyeOff icons to indicate visibility state
- Immediate persistence via updateSectionVisibility
- Category list for admins (display only for now)
- "New Category" button for admins using CreateCategoryDialog

Updated `src/app/(workspace)/[workspaceSlug]/settings/page.tsx`:
- Added link to Sidebar settings under Workspace section

### Task 3: Remove "New Category" button from sidebar

Updated `src/components/channel/category-sidebar.tsx`:
- Removed CreateCategoryDialog button at bottom of component
- Removed unused imports (FolderPlus, CreateCategoryDialog, Button)

Updated `src/components/workspace/workspace-sidebar.tsx`:
- Removed "New Category" button from non-category view
- Removed unused imports (FolderPlus, CreateCategoryDialog)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing type error in login-form.tsx**
- **Found during:** Task 1 build verification
- **Issue:** `twoFactorRedirect` property missing from better-auth types
- **Fix:** Added type assertion for 2FA response data
- **Files modified:** src/components/auth/login-form.tsx
- **Commit:** 96fa756

**2. [Rule 3 - Blocking] Missing organizationId prop in DMListClient**
- **Found during:** Task 1 build verification
- **Issue:** DMListClient now requires organizationId but workspace-sidebar wasn't passing it
- **Fix:** Added organizationId={workspace.id} prop
- **Files modified:** src/components/workspace/workspace-sidebar.tsx
- **Commit:** 96fa756

## Decisions Made

| ID | Decision | Rationale |
|-----|----------|-----------|
| SIDE-05 | Grip handle visible on hover | Consistent with category/channel drag pattern; clean UI |
| SIDE-06 | Checkbox toggles for visibility | Clear affordance; immediate feedback; accessible |

## Verification Results

1. SidebarSections component exists with SortableSection - PASS
2. updateSectionOrder imported and called - PASS
3. Sidebar settings page at /settings/sidebar - PASS
4. CreateCategoryDialog in settings client component - PASS
5. "New Category" removed from category-sidebar.tsx - PASS
6. "New Category" removed from workspace-sidebar.tsx - PASS
7. Build completes without errors - PASS

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 96fa756 | feat | create SidebarSections component with drag-and-drop |
| 3cd460a | feat | create sidebar settings page with section visibility |
| 7177099 | feat | remove 'New Category' button from sidebar |

## Next Phase Readiness

Ready for 34-05 (hook integration) or 34-06 (mobile reorder mode).

**Dependencies satisfied:**
- SidebarSections component ready for integration
- Settings page functional for visibility management
- "New Category" relocated to Settings

**No blockers or concerns.**

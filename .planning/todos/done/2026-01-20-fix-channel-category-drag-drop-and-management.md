---
created: 2026-01-20T22:05
title: Fix channel category drag-drop and management
area: ui
files:
  - src/components/channel/category-sidebar.tsx
  - src/lib/actions/channel-category.ts
---

## Problem

Channel categories (Phase 24-03, CCAT-01 to CCAT-06) have several issues discovered during verification:

1. **Drag and drop not working** - Channels cannot be dragged into categories. The droppable zones may not be registering drops correctly.

2. **No way to delete categories** - There's no UI to delete a category. The `deleteCategory` action exists but no UI exposes it.

3. **Possible additional issues** - Category management UX may need polish (edit category name, reorder categories, etc.)

Context: These issues were discovered during Phase 24-04 verification checkpoint. The category schema and server actions are implemented, but the UI interactions need fixes.

## Solution

1. Debug drag-drop: Check if `useDroppable` is working, verify `handleDragEnd` detects category drops
2. Move "New Category" button to Settings page (alongside delete capability)
3. Add delete category UI in Settings (admin only)
4. Consider: Edit category name, reorder categories via drag

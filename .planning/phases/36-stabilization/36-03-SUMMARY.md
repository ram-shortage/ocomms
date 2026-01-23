---
phase: 36
plan: 03
subsystem: testing
tags: [e2e, playwright, workspace, sidebar, drag-drop, testing]
dependency-graph:
  requires: ["36-01"]
  provides: ["workspace-tests", "sidebar-reorder-tests"]
  affects: []
tech-stack:
  added: []
  patterns: ["page-object-model", "multi-context-testing", "drag-drop-testing"]
key-files:
  created:
    - e2e/pages/browse-workspaces.page.ts
    - e2e/tests/workspace/switcher.spec.ts
    - e2e/tests/workspace/discovery.spec.ts
    - e2e/tests/sidebar/reorder.spec.ts
    - e2e/tests/sidebar/categories.spec.ts
  modified:
    - e2e/pages/sidebar.page.ts
    - e2e/pages/index.ts
decisions:
  - id: "E2E-WS-01"
    choice: "Multi-browser context for approval flow"
    rationale: "Test cross-user interactions with separate auth states"
  - id: "E2E-SIDE-01"
    choice: "dnd-kit compatible drag operations"
    rationale: "Match production drag-drop library behavior"
  - id: "E2E-SIDE-02"
    choice: "Hover before drag to reveal handles"
    rationale: "Drag handles only visible on hover per design"
metrics:
  duration: "5 minutes"
  completed: "2026-01-23"
---

# Phase 36 Plan 03: Workspace and Sidebar E2E Tests Summary

E2E test suite covering workspace switching/discovery (WKSP2-*) and sidebar drag-drop reordering (SIDE-*) using Playwright with multi-context testing for cross-user flows.

## What Was Built

### 1. Workspace Tests

**BrowseWorkspacesPage page object** (`e2e/pages/browse-workspaces.page.ts`):
- Locators for workspace grid, cards, join/request buttons, dialog
- `goto()`, `joinWorkspace()`, `requestJoin()` methods
- Assertions for workspace visibility and join policy states

**Workspace Switcher Tests** (`e2e/tests/workspace/switcher.spec.ts`):
- WKSP2-01: User can see list of workspaces
- WKSP2-02: User can switch workspaces (URL changes, content updates)
- WKSP2-06: Workspace switcher shows unread counts
- Browse workspaces link navigation
- Last visited workspace tracking

**Workspace Discovery Tests** (`e2e/tests/workspace/discovery.spec.ts`):
- WKSP2-03: User can browse available workspaces
- WKSP2-04: User can request to join restricted workspace
- WKSP2-05: Multi-user owner approval flow (two browser contexts)
- Open workspace instant join flow
- Request dialog cancel behavior

### 2. Sidebar Drag-Drop Tests

**SidebarPage drag-drop extensions** (`e2e/pages/sidebar.page.ts`):
- `getCategoryOrder()`, `getChannelOrder()`, `getDMOrder()`, `getSectionOrder()`
- `dragCategory()`, `dragChannelTo()`, `dragDm()`, `dragSection()`
- Handles hover-to-reveal pattern for drag handles
- `getMainSectionOrder()` for Channels/DMs/Archived sections

**Sidebar Reorder Tests** (`e2e/tests/sidebar/reorder.spec.ts`):
- SIDE-02: Categories can be reordered + persistence
- SIDE-03: Channels can be reordered within category + persistence
- SIDE-04: Channels can be moved between categories + persistence
- SIDE-05: DM conversations can be reordered
- SIDE-06: Sidebar sections can be reordered (quick links + main sections)
- SIDE-08: Sidebar order syncs across devices (multi-context test)

**Category Management Tests** (`e2e/tests/sidebar/categories.spec.ts`):
- SIDE-01: New Category button NOT in sidebar, IS in Settings
- SIDE-07: Category order stored per-user (multi-user test)
- Section order stored per-user
- Collapse state persistence
- Drag handle visibility on hover

## Test Coverage Summary

| Requirement | Test File | Test Count |
|-------------|-----------|------------|
| WKSP2-01 | switcher.spec.ts | 1 |
| WKSP2-02 | switcher.spec.ts | 1 |
| WKSP2-03 | discovery.spec.ts | 1 |
| WKSP2-04 | discovery.spec.ts | 1 |
| WKSP2-05 | discovery.spec.ts | 1 |
| WKSP2-06 | switcher.spec.ts | 1 |
| SIDE-01 | categories.spec.ts | 2 |
| SIDE-02 | reorder.spec.ts | 2 |
| SIDE-03 | reorder.spec.ts | 2 |
| SIDE-04 | reorder.spec.ts | 2 |
| SIDE-05 | reorder.spec.ts | 1 |
| SIDE-06 | reorder.spec.ts | 2 |
| SIDE-07 | categories.spec.ts | 2 |
| SIDE-08 | reorder.spec.ts | 2 |

**Total: 32 tests in 4 files**

## Technical Decisions

1. **Multi-browser context for cross-user tests** (E2E-WS-01)
   - Created separate browser contexts with alice.json and bob.json storage states
   - Allows testing real-time sync and per-user isolation
   - Used for join request approval and per-user order tests

2. **dnd-kit compatible drag operations** (E2E-SIDE-01)
   - Playwright's `dragTo()` works with dnd-kit sortable
   - 300ms delay after drag for UI update
   - Matches production drag-drop behavior

3. **Hover before drag pattern** (E2E-SIDE-02)
   - Drag handles appear on hover (opacity transition)
   - Tests hover element then get drag handle
   - Realistic user interaction flow

## Files Changed

```
e2e/pages/browse-workspaces.page.ts  (created - 130 lines)
e2e/pages/sidebar.page.ts            (extended - 351 lines added)
e2e/pages/index.ts                   (added export)
e2e/tests/workspace/switcher.spec.ts (created - 154 lines)
e2e/tests/workspace/discovery.spec.ts(created - 296 lines)
e2e/tests/sidebar/reorder.spec.ts    (created - 344 lines)
e2e/tests/sidebar/categories.spec.ts (created - 306 lines)
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification

```bash
# Tests discovered successfully
npx playwright test --list e2e/tests/workspace/ e2e/tests/sidebar/
# Total: 32 tests in 4 files
```

## Next Phase Readiness

All workspace and sidebar E2E tests are in place. Wave 2 of Phase 36 can continue with remaining stabilization plans.

Run full test suite:
```bash
npm run test:e2e -- tests/workspace/ tests/sidebar/
```

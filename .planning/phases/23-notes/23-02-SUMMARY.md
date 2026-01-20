---
phase: 23-notes
plan: 02
subsystem: api, ui
tags: [react-markdown, notes, optimistic-locking, markdown, conflict-detection]

# Dependency graph
requires:
  - phase: 23-01
    provides: channelNotes and personalNotes database schemas with version column
provides:
  - GET/PUT API routes for channel notes with optimistic locking
  - GET/PUT API routes for personal notes with optimistic locking
  - NoteEditor component with edit/preview toggle and auto-save
  - NoteViewer component for XSS-safe markdown rendering
  - ConflictDialog component for version conflict resolution
  - debounce utility function
affects: [23-03, 23-04]

# Tech tracking
tech-stack:
  added: [react-markdown@10.1.0, remark-gfm@4.0.1, rehype-highlight@7.0.2]
  patterns: [optimistic locking via version column, edit/preview toggle, debounced auto-save]

key-files:
  created:
    - src/app/api/notes/channel/route.ts
    - src/app/api/notes/personal/route.ts
    - src/components/notes/note-editor.tsx
    - src/components/notes/note-viewer.tsx
    - src/components/notes/conflict-dialog.tsx
    - src/lib/utils/debounce.ts

key-decisions:
  - "Use react-markdown for XSS-safe rendering (no dangerouslySetInnerHTML)"
  - "2 second debounce delay for auto-save"
  - "Version 0 indicates new note, triggers INSERT instead of UPDATE"
  - "409 status code for version conflicts with full server state"

patterns-established:
  - "Optimistic locking: WHERE version = baseVersion, return 409 on mismatch"
  - "Edit/preview toggle: mode state switches between Textarea and NoteViewer"
  - "Debounced auto-save: useCallback + debounce utility, triggered on content change"
  - "Conflict resolution: store serverContent/serverVersion, let user choose"

# Metrics
duration: 8min
completed: 2026-01-20
---

# Phase 23 Plan 02: Notes API and Components Summary

**API routes for channel/personal notes with optimistic locking, plus NoteEditor component with markdown preview and conflict detection**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-20T19:02:00Z
- **Completed:** 2026-01-20T19:10:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Channel notes API with GET/PUT and optimistic locking via version column
- Personal notes API with GET/PUT and optimistic locking via version column
- NoteEditor component with edit/preview toggle, 2s debounced auto-save
- NoteViewer for XSS-safe markdown rendering using react-markdown
- ConflictDialog for version mismatch resolution (keep yours vs theirs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-markdown and plugins** - `00348a6` (chore)
2. **Task 2: Create API routes for notes** - `9d633ed` (feat)
3. **Task 3: Create note UI components** - `cd32e44` (feat)

## Files Created/Modified

- `package.json` - Added react-markdown, remark-gfm, rehype-highlight
- `src/app/api/notes/channel/route.ts` - GET/PUT for channel notes with optimistic locking
- `src/app/api/notes/personal/route.ts` - GET/PUT for personal notes with optimistic locking
- `src/components/notes/note-editor.tsx` - Main editor with edit/preview and auto-save
- `src/components/notes/note-viewer.tsx` - Read-only markdown renderer
- `src/components/notes/conflict-dialog.tsx` - Version conflict resolution dialog
- `src/lib/utils/debounce.ts` - Generic debounce utility function

## Decisions Made

- **react-markdown over dangerouslySetInnerHTML** - XSS-safe rendering by converting markdown to React components
- **2 second debounce for auto-save** - Balance between responsiveness and API load
- **Version 0 for new notes** - Indicates INSERT needed; version >= 1 indicates existing note requiring UPDATE
- **409 status for conflicts** - Standard HTTP status for conflict; includes serverContent and serverVersion for resolution
- **Skip socket.io emission in API routes** - API routes don't have access to socket instance; socket handlers will handle real-time updates in Plan 03

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all packages installed and components compiled without errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- API routes ready for UI integration
- NoteEditor component ready to be embedded in channel header sheet and sidebar
- Socket.io note:updated event already defined in socket-events.ts; handlers needed in Plan 03
- Plan 03 will add notes UI integration to channel header and sidebar

---
*Phase: 23-notes*
*Completed: 2026-01-20*

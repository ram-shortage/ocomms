# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Data sovereignty - complete control over communication data
**Current focus:** v0.4.0 Files, Theming & Notes

## Current Position

Phase: 23 of 23 (Shared Notes)
Plan: 3 of 4 complete
Status: In progress
Last activity: 2026-01-20 - Completed 23-04-PLAN.md (personal notes page)

Progress: [#######################-] 96% (2.95/3 phases in v0.4.0)

## Shipped Milestones

- **v0.3.0 Mobile & Polish** - 2026-01-19
  - 7 phases (14-20), 23 plans, 38 requirements
  - PWA, offline, push notifications, mobile layout, admin UI
  - See: .planning/milestones/v0.3.0-ROADMAP.md

- **v0.2.0 Security Hardening** - 2026-01-18
  - 5 phases (9-13), 24 plans, 19 requirements
  - See: .planning/milestones/v0.2.0-ROADMAP.md

- **v0.1.0 Full Conversation** - 2026-01-18
  - 8 phases (1-8), 23 plans, 51 requirements
  - See: .planning/milestones/v0.1.0-ROADMAP.md

## Performance Metrics

**Cumulative (through v0.3.0):**
- Total plans completed: 78 (70 + 8 test plans)
- Total requirements delivered: 108 (51 + 19 + 38)
- Total phases completed: 20

**v0.4.0 progress:**
- Phase 21: 2 plans complete (theme infrastructure + color audit)
- Phase 22: 3 plans complete (file upload backend + UI + display)
- Phase 23: 3 of 4 plans complete (notes schema + API/components + personal notes page)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions for v0.4.0:
- next-themes for theming (de facto standard, FOUC prevention)
- Extend avatar upload pattern for file uploads (proven approach)
- react-markdown for notes (XSS-safe, no dangerouslySetInnerHTML)
- Last-write-wins with conflict detection for notes (not CRDT/OT)
- XHR over fetch for upload progress support (fetch lacks upload progress events)
- next/image unoptimized for uploaded files (not in Next.js image domains)
- Validate attachment ownership before linking to messages
- 2 second debounce for note auto-save (balance responsiveness and API load)
- Version 0 indicates new note (INSERT), version >= 1 indicates UPDATE

### Theming Patterns Established (Phase 21)
- bg-card for content containers
- bg-muted for hover states and subtle backgrounds
- text-foreground for primary text
- text-muted-foreground for secondary text
- text-primary for links and interactive elements
- ring-card for presence indicators

### File Upload Patterns Established (Phase 22)
- validateFileSignature() for magic bytes validation (shared library)
- Attachment metadata in database, file on disk with UUID name
- messageId nullable for upload-before-send flow
- uploadFile() with progress callback and abort signal
- Staged attachments pattern for upload-before-send UI
- QueuedMessage extended with attachmentIds for offline-first
- FileAttachment component for image preview vs download card
- formatBytes() for human-readable file sizes
- attachmentsByMessageId Map for efficient grouping in page loads

### Notes Patterns Established (Phase 23)
- Version column for optimistic locking conflict detection
- One note per channel via unique index on channelId
- One personal note per user per org via composite unique index
- Optimistic locking: WHERE version = baseVersion, return 409 on mismatch
- Edit/preview toggle: mode state switches between Textarea and NoteViewer
- Debounced auto-save: useCallback + debounce utility, triggered on change
- Conflict resolution: store serverContent/serverVersion, let user choose
- Personal notes page: header with title/subtitle, full-height NoteEditor in bg-card container
- Sidebar quick links: icon + label with hover:bg-accent and active bg-accent states

### Pending Todos

None - Phase 23-04 complete.

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-01-20 19:30Z
Stopped at: Completed 23-04-PLAN.md (personal notes page)
Resume file: .planning/phases/23-notes/23-03-PLAN.md

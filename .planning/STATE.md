# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Data sovereignty - complete control over communication data
**Current focus:** v0.4.0 Files, Theming & Notes

## Current Position

Phase: 22 of 23 (File Uploads)
Plan: 2 of ? in progress
Status: In progress
Last activity: 2026-01-20 - Completed 22-02-PLAN.md (file upload UI)

Progress: [##################------] 77% (2.5/3 phases in v0.4.0)

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
- Phase 22: 2 plans complete (file upload backend + UI)
- Phase 23: 0 plans complete (shared notes - not started)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions for v0.4.0:
- next-themes for theming (de facto standard, FOUC prevention)
- Extend avatar upload pattern for file uploads (proven approach)
- react-markdown for notes (XSS-safe, no dangerouslySetInnerHTML)
- Last-write-wins with conflict detection for notes (not CRDT/OT)
- XHR over fetch for upload progress support (fetch lacks upload progress events)

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

### Pending Todos

None - plan 22-02 complete.

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-01-20
Stopped at: Completed 22-02-PLAN.md (file upload UI)
Resume file: .planning/phases/22-file-uploads/22-03-PLAN.md

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Data sovereignty - complete control over communication data
**Current focus:** v0.4.0 Files, Theming & Notes

## Current Position

Phase: 21 of 23 (Dark Mode/Theming)
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-01-20 - Completed 21-01-PLAN.md (theme infrastructure)

Progress: [########----------------] 33% (1/3 plans in v0.4.0)

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions for v0.4.0:
- next-themes for theming (de facto standard, FOUC prevention)
- Extend avatar upload pattern for file uploads (proven approach)
- react-markdown for notes (XSS-safe, no dangerouslySetInnerHTML)
- Last-write-wins with conflict detection for notes (not CRDT/OT)

### Pending Todos

None - starting fresh milestone.

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-01-20
Stopped at: Completed 21-01-PLAN.md (theme infrastructure)
Resume file: .planning/phases/21-dark-mode-theming/21-02-PLAN.md

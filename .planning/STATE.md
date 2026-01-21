# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Data sovereignty - complete control over communication data
**Current focus:** v0.5.0 Feature Completeness - Phase 26 (Collections & Presence)

## Current Position

Phase: 26 of 29 (Collections & Presence)
Plan: 5 of 6 complete
Status: In progress
Last activity: 2026-01-21 - Completed 26-05-PLAN.md (Status UI Components)

Progress: [████████░░] 5/6 plans in phase 26

## Shipped Milestones

- **v0.4.0 Files, Theming & Notes** - 2026-01-20
  - 3 phases (21-23), 9 plans, 22 requirements
  - Dark mode, file uploads, channel/personal notes
  - See: .planning/milestones/v0.4.0-ROADMAP.md

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

**Cumulative (through v0.4.0):**
- Total plans completed: 87 (23 + 24 + 31 + 9)
- Total requirements delivered: 130 (51 + 19 + 38 + 22)
- Total phases completed: 23

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
v0.5.0 research decisions documented in .planning/research/SUMMARY.md:
- BullMQ for scheduled jobs (Redis-based, persistent across restarts)
- unfurl library for link previews (lightweight, no headless browser)
- sharp for custom emoji (SVG-to-PNG conversion for XSS protection)

Phase 24-01 decisions:
- Track per-socket typing state for disconnect cleanup
- Client-side throttle for network efficiency
- Reset throttle timer on send for better UX

Phase 24-02 decisions:
- Default channel (#general) cannot be archived
- Archived channels remain searchable by default
- Archive/unarchive requires admin role or creator status
- Archived section hidden when no archived channels exist

Phase 24-03 decisions:
- Admin-only category management (create, reorder, assign channels)
- Per-user collapse states stored in separate table
- Conditional category view (flat list when no categories exist)
- Empty categories auto-hide from sidebar

Phase 25-01 decisions:
- Use ConnectionOptions instead of Redis instance to avoid ioredis type conflicts
- Separate worker process from Next.js server for non-blocking job processing
- Configure 3 attempts with exponential backoff (1s base) for job retries

Phase 25-02 decisions:
- withTimezone for all timestamp columns (scheduledFor, remindAt, etc.) for UTC handling
- Nullable channelId/conversationId on scheduled_messages allows either target type
- Separate reminderPatternEnum for daily/weekly recurring support (RMND-07)

Phase 25-03 decisions:
- Use shared emitter from @/server/queue/emitter instead of creating separate Redis connection in worker
- Schedule feedback shown inline in message input (no toast system needed)
- Quick-pick presets: Tomorrow 9am and Monday 9am (deliberately minimal per CONTEXT.md)

Phase 25-04 decisions:
- Redis emitter for worker-to-client Socket.IO events (avoids full server dependency)
- Sheet panel for reminder details (consistent with thread panel pattern)
- Preset times for reminders (Tomorrow 9am, Monday 9am) match scheduled messages
- Fixed snooze intervals as quick taps (20min, 1hr, 3hr, tomorrow)

Phase 26-01 decisions:
- Polymorphic bookmarks via nullable messageId/fileId with type enum
- One status per user enforced via unique constraint on userId
- Status expiration uses same BullMQ pattern as reminders (3 attempts, exponential backoff)

Phase 26-02 decisions:
- Bookmark access verification reuses message access pattern from reminders
- User status upsert with explicit check-then-update/insert for job management clarity
- JobId format includes timestamp for uniqueness: status-${userId}-${Date.now()}

Phase 26-03 decisions:
- Notifications stored in DB (for history) but real-time delivery blocked by DND
- DND check happens early in push sender (before getting subscriptions) for efficiency
- Centralized isUserDndEnabled function exported from push/send.ts for reuse

Phase 26-04 decisions:
- Yellow highlight for bookmark button (matches Slack convention)
- No initial bookmarked state fetching - users see filled icon after clicking
- Click bookmark item navigates to channel/DM (no detail panel like reminders)
- Separate messages and files sections in bookmark list

Phase 26-05 decisions:
- Added Switch UI component (radix-ui) that was missing from project
- Status passed as prop to MessageItem to avoid N+1 queries
- Expiration stored as label, recalculated to Date on save
- StatusIndicator uses 30s refresh interval for status updates

### Pending Todos

2 todos pending - see `.planning/todos/pending/`
- **Fix channel category drag-drop and management** (ui) - drag-drop not working, no delete UI
- **Fix typing bar layout - excessive whitespace below input** (ui) - flex layout not constraining height properly

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-01-21
Stopped at: Completed 26-05-PLAN.md (Status UI Components)
Resume file: None - continue with 26-06-PLAN.md

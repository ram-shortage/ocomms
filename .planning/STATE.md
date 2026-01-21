# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-20)

**Core value:** Data sovereignty - complete control over communication data
**Current focus:** v0.5.0 Feature Completeness - Phase 29 (Stabilization)

## Current Position

Phase: 29 of 29 (Stabilization)
Plan: 6 of TBD complete (29-01, 29-02, 29-03, 29-04, 29-05, 29-06)
Status: In progress
Last activity: 2026-01-21 - Completed 29-06-PLAN.md (Low Severity Quick Fixes)

Progress: [████████████████████] 5/6 phases in v0.5.0

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

Phase 27-01 decisions:
- withTimezone for all timestamp columns (consistent with Phase 25 patterns)
- Position tracking in junction table for multiple URL ordering (LINK-02)
- Hidden flag for user-dismissed previews (LINK-06)
- isAnimated flag on custom_emojis for GIF detection (EMOJ-07)

Phase 27-02 decisions:
- Use node-fetch v2 with request-filtering-agent for SSRF protection
- Custom safeFetch wrapper for unfurl.js integration
- 10 concurrent workers for fetch-heavy link preview processing

Phase 27-03 decisions:
- Hide button uses nested group (group/preview) for independent hover state
- Domain extracted from URL as fallback when siteName is null
- Skip rendering card entirely if no title, description, or image

Phase 27-04 decisions:
- Admin/owner role required for workspace-level emoji uploads
- SVG converted to PNG for XSS protection (EMOJ-08)
- 128x128 standard emoji size with transparent background
- File cleanup on delete with graceful failure handling

Phase 27-05 decisions:
- Use --legacy-peer-deps for emoji-mart (React 19 compatibility)
- Custom emoji stored as :name: format for display resolution
- Emoji picker lazy loads data to reduce initial bundle

Phase 27-06 decisions:
- Fire-and-forget pattern for link preview queueing (non-blocking)
- Job ID format ${messageId}-${url} for deduplication
- Client wrappers pattern for emoji settings page
- Custom emoji regex pattern: :([a-zA-Z0-9_-]+):

Phase 28-01 decisions:
- Extended members table with guest fields rather than separate guest table
- Guest channel access uses junction table for flexible channel-scoped permissions
- Guest invites store channelIds as JSON text for simplicity
- guestJobId on members for BullMQ expiration job tracking (matching status-expiration pattern)

Phase 28-02 decisions:
- Explicit TypeScript interfaces for Recharts v3 payload types (avoids complex generic inference)
- Filter channels by organizationId first, then query messages - efficient multi-tenant isolation
- WAU/MAU trend calculated by comparing current vs previous week counts

Phase 28-03 decisions:
- Group mentions use same @handle syntax as users - resolved at notification time
- UGRP-06 intersection: group members must also be channel members to receive notification
- Group mentions treated as 'mention' type for notification settings compatibility
- parseMentions remains synchronous - async group lookup happens in notification handler

Phase 28-04 decisions:
- Guest soft-lock allows viewing but prevents posting (24-hour grace period)
- Guest expiration job checks jobId match before soft-locking (race condition protection)
- Guests cannot initiate DMs but can reply to member-initiated ones
- Guest channel access checked at both action and socket handler level (defense in depth)

Phase 28-05 decisions:
- Group handles use same @syntax as users - differentiated by purple color and popup
- Groups tab only shows if workspace has at least one group defined
- Guests excluded from groups with tooltip explanation (GUST-07 compliance)

Phase 28-06 decisions:
- Guest badge uses amber color to distinguish from roles
- Welcome modal shown via localStorage flag set during redemption
- Guest status fetched per-request for initial messages, included in real-time broadcasts

Phase 28-07 decisions:
- Lazy load data per tab to optimize initial page load
- Manual refresh only (no auto-polling) per CONTEXT.md
- Client-side CSV export with BOM for Excel UTF-8 compatibility
- Top 10 channels in activity table, rest aggregated as "Other"

Phase 28-08 decisions:
- membersRelations alias required for Drizzle relational query API compatibility
- returnUrl preserved through login/signup flow for guest invite redemption
- Chart colors brightened for dark mode contrast (lightness 0.7-0.8)
- GUST-04 marked for further testing (email verification returnUrl complexity)

Phase 29-01 decisions:
- Use existing authz.ts helpers consistently across socket handlers
- Socket authorization pattern: check membership before socket.join() or socket.to().emit()
- Error emission pattern: socket.emit('error', { message }) on failed auth with early return

Phase 29-04 decisions:
- 100 IDs per request limit for presence/unread (prevents memory exhaustion)
- 100 max / 50 default notification limit (balances UX and performance)
- inArray batch query for channels (eliminates N+1 in notification handler)

Phase 29-03 decisions:
- Match message.ts retry pattern for consistency (insertReplyWithRetry)
- MAX_PAGE_SIZE=100, DEFAULT_PAGE_SIZE=50 for thread pagination
- Use explicit asc() ordering for clarity in paginated queries

Phase 29-02 decisions:
- getUserStatus requires organizationId for cross-user lookup, self-lookup allowed without
- getGroupMembers hides email for non-admin users (privacy improvement)
- getGroupByHandle added session + org membership verification
- getMessagePreviews verifies channel membership or conversation participation

Phase 29-05 decisions:
- Use local state in WorkspaceSidebar to track status for immediate UI updates
- Add onStatusSaved/onStatusCleared callbacks to StatusEditor
- Export UserStatusData interface for type reuse between components

Phase 29-06 decisions:
- L-4 already fixed in Phase 29-02 - getGroupByHandle has auth
- Personal notes workspace membership check uses member table
- Pins batch lookup with inArray replaces N+1 for loop
- Notification settings pre-fetched once per channel for all users

### Pending Todos

2 todos pending - see `.planning/todos/pending/`
- **Fix channel category drag-drop and management** (ui) - drag-drop not working, no delete UI
- **Fix typing bar layout - excessive whitespace below input** (ui) - flex layout not constraining height properly

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-01-21
Stopped at: Completed 29-06-PLAN.md (Low Severity Quick Fixes)
Resume file: None

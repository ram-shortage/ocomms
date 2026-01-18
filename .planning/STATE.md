# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-17)

**Core value:** Data sovereignty - Complete control over communication data, no third-party dependencies
**Current focus:** Phase 6 - Attention Management

## Current Position

Phase: 6 of 8 (Attention Management)
Plan: 0 of 1 in current phase
Status: Ready for planning
Last activity: 2026-01-18 - Completed Phase 5 (Mentions & Notifications)

Progress: ████████████████░ 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 4.5 min
- Total execution time: 79 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-foundation | 4/4 | 16 min | 4 min |
| 2-channels-dms | 3/3 | 17 min | ~6 min |
| 3-real-time-messaging | 3/3 | 16 min | ~5 min |
| 4-threading-reactions | 3/3 | 17 min | ~6 min |
| 5-mentions-notifications | 3/3 | 13 min | ~4 min |

**Recent Trend:**
- Last 5 plans: 9 min, 5 min, 6 min, 3 min, 4 min
- Trend: Stable

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 1-01 | Manual better-auth schema | CLI requires database connection |
| 1-01 | UUID primary keys | Follows better-auth conventions |
| 1-01 | snake_case DB naming | PostgreSQL best practice via Drizzle casing |
| 1-02 | Fire-and-forget emails | Prevent timing attacks revealing user existence |
| 1-02 | 7-day sessions with daily refresh | Balance security and UX |
| 1-02 | Middleware + page validation | Middleware for redirect, pages for full validation |
| 1-03 | Auto-slug from workspace name | User-friendly URL generation |
| 1-03 | Role hierarchy (owner > admin > member) | Consistent permission model |
| 1-04 | Local filesystem for avatars | Simple storage, migrate to S3 later |
| 1-04 | UUID filenames for avatars | Prevent collisions and enumeration |
| 2-01 | Unique (org_id, slug) index | Ensures unique channel names per workspace |
| 2-01 | createdBy set null on delete | Preserve channel if creator leaves |
| 2-01 | Creator as admin member | Transaction ensures consistent membership |
| 2-02 | Admin leave protection | Cannot leave if sole admin with members |
| 2-02 | Topic vs Description | Any member edits topic, admin edits description |
| 2-03 | 1:1 DMs have null name | Display other person's name in UI |
| 2-03 | Adding to 1:1 converts to group | Seamless participant expansion |
| 2-03 | Duplicate 1:1 prevention | Check existing participants before creating |
| 3-01 | Redis graceful fallback | Local dev works without Redis; production gets scaling |
| 3-01 | Cookie-based WebSocket auth | Consistent auth with HTTP routes via better-auth |
| 3-01 | Prefixed room names | channel:, dm:, workspace:, user: prevents collisions |
| 3-02 | Sequence numbers for ordering | Avoids clock skew across distributed systems |
| 3-02 | Soft delete pattern | Preserves message history, shows [deleted] in UI |
| 3-02 | Callback acknowledgement | Socket emit uses callback to confirm save |
| 3-03 | 60s TTL / 30s heartbeat | Balances responsiveness with Redis load |
| 3-03 | workspace:join event | Explicit workspace context for presence |
| 3-03 | Visibility API for away | Tab blur/focus for automatic away detection |
| 4-01 | Self-referencing parentId | No separate threads table, simpler queries |
| 4-01 | Single-level threading only | Replies cannot have replies (Slack pattern) |
| 4-01 | Denormalized replyCount | Avoid COUNT query on every message render |
| 4-02 | frimousse emoji picker | <5KB vs 50KB alternatives, shadcn integration |
| 4-02 | Composite unique for reactions | Race-safe, prevents duplicate emoji per user |
| 4-03 | REST API for pins | Low frequency ops, no real-time broadcast needed |
| 4-03 | Client wrapper for pin state | Separate server fetching from client state |
| 4-03 | Optimistic pin updates | Immediate UI feedback, revert on failure |
| 5-01 | Quoted name support in mentions | @"John Doe" for display names with spaces |
| 5-01 | currentUsername prop drilling | Pass through hierarchy for self-mention emphasis |
| 5-01 | Special mention colors | Amber for @channel/@here, blue for user mentions |
| 5-02 | User lookup by name | @mentions match display names for notification targeting |
| 5-02 | @here uses presence filter | Only active users receive @here notifications |
| 5-02 | Notification user rooms | user:{userId} rooms for personal delivery |
| 5-03 | No entry = "all" mode | Only store settings when user changes from default |
| 5-03 | Delete row for "all" mode | Upsert non-default, delete default values |
| 5-03 | shouldNotify() filtering | Check settings at notification creation time |

### Pending Todos

- Complete USER-SETUP.md (PostgreSQL, SMTP configuration)
- Configure REDIS_URL for production scaling (optional for dev)

### Blockers/Concerns

Database connection required before `npm run db:push` can verify schema.

## Session Continuity

Last session: 2026-01-18
Stopped at: Completed Phase 5 - Ready for Phase 6 planning
Resume file: None

# Project Research Summary

**Project:** OComms v0.5.0 Feature Completeness
**Domain:** Self-hosted team communication platform (Slack alternative)
**Researched:** 2026-01-20
**Confidence:** HIGH

## Executive Summary

OComms v0.5.0 aims to deliver 12 feature areas that bring the platform to feature parity with mainstream team communication tools. The research reveals that most features (10 of 12) require zero or minimal new dependencies, leveraging the existing Socket.IO + Redis + PostgreSQL/Drizzle stack. Three targeted library additions are needed: **BullMQ** for scheduled jobs (scheduled messages, reminders), **unfurl** for link preview metadata extraction, and **sharp** for custom emoji image processing. The existing architecture patterns are well-suited for extension.

The recommended approach groups features by shared infrastructure requirements rather than individual feature complexity. Features requiring the BullMQ job queue (scheduled messages, reminders, status expiration, link preview fetching) should be built together after establishing that foundation. Similarly, features that are pure database extensions with no new patterns (bookmarks, channel archiving, channel categories) can be implemented quickly in parallel. Typing indicators are low-hanging fruit since the Socket.IO events are already defined in the codebase. User groups and guest accounts require careful authorization work and should come later in the milestone.

Key risks center on security (SSRF in link previews, XSS in custom emoji SVG uploads, guest account data isolation) and performance (typing indicator broadcast storms at scale). All critical pitfalls have documented mitigations: URL validation for SSRF, PNG conversion for custom emoji, centralized authorization checks for guests, and client-side throttling for typing indicators. The analytics feature requires privacy-conscious design to avoid GDPR issues. The scheduled job reliability pitfall (messages not sending on server restart) is solved by using BullMQ with Redis persistence rather than in-memory schedulers.

## Key Findings

### Recommended Stack

The existing OComms stack handles most v0.5.0 features without additions. See [STACK-v0.5.0.md](./STACK-v0.5.0.md) for full details.

**New dependencies (3 total):**
- **bullmq** (^5.66.5): Redis-based job queue for scheduled messages, reminders, and background tasks — already using Redis, no new infrastructure
- **unfurl** (^6.4.0): Metadata extraction for link previews — lightweight, handles Open Graph/Twitter Cards without headless browser
- **sharp** (^0.34.5): Image processing for custom emoji — converts uploads to consistent PNG, strips SVG scripts

**Existing stack leverage:**
- Socket.IO + Redis: Typing indicators, status broadcasts, real-time updates (8 features use existing patterns)
- PostgreSQL + Drizzle: All schema additions, soft deletes for archiving, analytics aggregates
- better-auth: Guest accounts via existing anonymous plugin
- frimousse: Emoji picker for status messages (custom emoji integration TBD due to missing upstream support)

### Expected Features

Based on Slack, Discord, and Teams patterns. See [FEATURES.md](./FEATURES.md) for detailed analysis.

**Table stakes (must have):**
- User status messages with emoji, text, and expiration
- Typing indicators showing who is composing
- Bookmarks / saved messages for personal collection
- Channel archiving with read-only preservation
- Basic link previews (Open Graph + Twitter Cards)
- Custom emoji upload and usage in messages/reactions

**Competitive (should have):**
- Channel categories for sidebar organization
- User groups for @team mentions
- Scheduled messages with one-time scheduling
- Reminders about specific messages
- Guest accounts with channel-restricted access
- Workspace analytics (aggregate metrics only)

**Defer to v2+:**
- Calendar sync for auto-status
- Recurring scheduled messages (workflow builder territory)
- Per-category channel permissions (Discord's model, adds complexity)
- Individual user activity tracking in analytics (privacy concerns)
- Natural language reminder parsing

### Architecture Approach

OComms follows consistent patterns: Socket.IO handlers for real-time, API routes for CRUD, Drizzle schema extensions for data, Redis for ephemeral state. See [ARCHITECTURE-v0.5.0.md](./ARCHITECTURE-v0.5.0.md) for component boundaries.

**Major components by feature type:**

1. **Real-time extensions** (typing, status) — New Socket.IO handlers in `handlers/`, ephemeral Redis state, broadcast to rooms
2. **Personal collections** (bookmarks, reminders) — New tables with user foreign key, API routes only, no real-time needed
3. **Background jobs** (scheduled messages, link previews) — BullMQ workers, status tracking in database, async processing
4. **Authorization extensions** (guest accounts, user groups) — Centralized middleware in `authz.ts`, role-based checks
5. **UI organization** (categories, archiving) — Schema extensions with position/status columns, sidebar filtering

**Data flow pattern:**
- Real-time features: Client emits -> Socket handler -> Redis/DB -> Broadcast to room
- CRUD features: Client calls -> API route -> Drizzle query -> Response
- Background jobs: API creates job -> BullMQ queues -> Worker processes -> Socket broadcasts result

### Critical Pitfalls

Top 5 from [PITFALLS-v0.5.0.md](./PITFALLS-v0.5.0.md) requiring attention:

1. **Link preview SSRF** — Validate URLs before fetch, block internal IPs, cloud metadata endpoints (169.254.169.254), and non-http protocols. Set strict timeouts (5s) and redirect limits (3).

2. **Custom emoji SVG XSS** — Convert all uploads to PNG using sharp. Never serve SVG files directly. If SVG must be supported, sanitize with DOMPurify and serve with `Content-Security-Policy: script-src 'none'`.

3. **Guest account data isolation** — Centralize authorization in middleware, verify channel access for guests against allowlist, use PostgreSQL RLS as defense-in-depth. Write integration tests for cross-tenant scenarios.

4. **Typing indicator broadcast storms** — Throttle client-side (max 1 event per 3 seconds), rate-limit server-side (Redis key with TTL), auto-expire typing status after 5 seconds. For large channels (100+), aggregate "N people typing".

5. **Scheduled message reliability** — Use BullMQ (not node-cron) for persistence across restarts. Store scheduled messages in database with status tracking. Implement retry logic (3 attempts) and monitoring for stuck jobs.

## Implications for Roadmap

Based on research, suggested 5-phase structure for the 12 features plus stabilization:

### Phase 1: Quick Wins
**Rationale:** Three features with minimal complexity and no new infrastructure. Establishes momentum and visible progress.
**Delivers:** Channel lifecycle management, typing awareness, personal organization
**Features:** Typing indicators, channel archiving, channel categories
**Avoids:** N/A — these are low-risk implementations
**Stack:** Existing Socket.IO events (typing already defined), simple schema additions
**Duration estimate:** 1-2 weeks

### Phase 2: Job Queue Foundation + Scheduled Features
**Rationale:** Scheduled messages and reminders share BullMQ infrastructure. Build foundation once, implement both features.
**Delivers:** Async message scheduling, personal reminders, job queue infrastructure for later features
**Features:** Scheduled messages, reminders
**Avoids:** Scheduled message reliability failures (CRIT-4) by using BullMQ from start
**Stack:** bullmq (new), extends existing messages/notifications
**Duration estimate:** 2 weeks

### Phase 3: User Collections + Presence
**Rationale:** Bookmarks and status messages are independent CRUD features. Group for efficiency.
**Delivers:** Personal saved messages, rich user presence with status
**Features:** Bookmarks/saved messages, user status messages
**Avoids:** Bookmarks N+1 queries (use eager loading), status race conditions (use version numbers)
**Stack:** New tables, extends profiles, existing frimousse emoji picker
**Duration estimate:** 1-2 weeks

### Phase 4: Rich Content
**Rationale:** Link previews and custom emoji both involve external content processing with security concerns. Group for focused security review.
**Delivers:** Link unfurling in messages, workspace custom emoji
**Features:** Link previews/unfurling, custom emoji
**Avoids:** SSRF (CRIT-1) with URL validation, SVG XSS (CRIT-2) with PNG conversion
**Stack:** unfurl (new), sharp (new), async preview fetching via BullMQ
**Duration estimate:** 2 weeks

### Phase 5: Authorization + Analytics
**Rationale:** User groups and guest accounts both require authorization system changes. Analytics requires privacy review. Group complex authz work together.
**Delivers:** Team mentions, external collaborator access, workspace health metrics
**Features:** User groups (@team mentions), guest accounts, workspace analytics
**Avoids:** Guest isolation failures (CRIT-3) with centralized authz, notification floods (IMP-4) with rate limits, privacy violations (IMP-8) with aggregate-only metrics
**Stack:** Extends better-auth, new authz middleware, aggregate queries
**Duration estimate:** 3 weeks

### Phase 6: Stabilization
**Rationale:** Final phase for test coverage, bug fixing, and polish before release.
**Delivers:** Production-ready v0.5.0
**Features:** Test creation, bug fixes, performance optimization
**Duration estimate:** 1-2 weeks

### Phase Ordering Rationale

- **Infrastructure dependencies:** BullMQ foundation (Phase 2) enables link preview async fetching (Phase 4)
- **Risk management:** Quick wins first (Phase 1) to build confidence before complex authz (Phase 5)
- **Security grouping:** Content processing features (Phase 4) together for focused security review
- **Authorization complexity:** Guest accounts and user groups both touch permissions system, minimize context switching
- **Parallel opportunities:** Phases 1, 3 features are independent — could be parallelized with other work

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 4 (Rich Content):** Custom emoji requires investigation of frimousse PR #25 status or alternative approaches
- **Phase 5 (Guest Accounts):** Better-auth anonymous plugin configuration needs validation
- **Phase 5 (Analytics):** May need GDPR/privacy compliance review depending on deployment context

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Quick Wins):** All three features have well-documented Slack patterns, typing events already defined
- **Phase 2 (Scheduled Features):** BullMQ documentation comprehensive, scheduled job pattern established
- **Phase 3 (Collections):** Standard CRUD patterns, no novel approaches needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against existing codebase, libraries have active maintenance and TypeScript support |
| Features | HIGH | Slack/Discord/Teams official docs provide clear feature specifications |
| Architecture | HIGH | Based on existing OComms patterns in codebase analysis |
| Pitfalls | HIGH | Security pitfalls (SSRF, XSS) well-documented with CVEs and case studies |

**Overall confidence:** HIGH

### Gaps to Address

- **frimousse custom emoji support:** PR #25 pending merge. Mitigation: Plan for separate custom emoji tab in picker UI, or fork if needed
- **better-auth anonymous plugin:** Documentation exists but OComms-specific configuration needs validation. Mitigation: Spike during Phase 5 planning
- **Workspace analytics privacy:** GDPR requirements vary by deployment context. Mitigation: Build aggregate-only by default, document privacy implications

## Sources

### Primary (HIGH confidence)
- [Slack Help Center](https://slack.com/help) — Feature specifications for all 12 areas
- [Slack Developer Docs](https://docs.slack.dev) — API patterns, typing events, unfurling
- [BullMQ Documentation](https://docs.bullmq.io) — Job queue patterns
- [sharp Documentation](https://sharp.pixelplumbing.com/) — Image processing
- OComms codebase analysis — Existing patterns in `src/db/schema/`, `src/server/socket/handlers/`

### Secondary (MEDIUM confidence)
- [Discord Support](https://support.discord.com) — Channel categories pattern
- [PortSwigger SSRF Guide](https://portswigger.net/web-security/ssrf) — Link preview security
- [Socket.IO Performance Tuning](https://socket.io/docs/v4/performance-tuning/) — Typing indicator scaling
- [unfurl GitHub](https://github.com/jacktuck/unfurl) — Link preview library

### Tertiary (MEDIUM confidence)
- [Securitum SVG XSS Research](https://research.securitum.com/do-you-allow-to-load-svg-files-you-have-xss/) — Custom emoji security
- [GDPR Employee Monitoring Guide](https://gdprlocal.com/gdpr-employee-monitoring/) — Analytics privacy considerations

---
*Research completed: 2026-01-20*
*Ready for roadmap: yes*

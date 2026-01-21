# Roadmap: OComms v0.5.0 Feature Completeness

## Overview

v0.5.0 delivers the complete platform feature set: user presence enhancements (status messages, typing indicators), personal organization (bookmarks, scheduled messages, reminders), workspace structure (channel categories, user groups, archiving), rich content (link previews, custom emoji), access control (guest accounts), and operational visibility (workspace analytics). The milestone concludes with comprehensive testing and stabilization to ensure production readiness.

## Milestones

- **v0.1.0 Full Conversation** - Phases 1-8 (shipped 2026-01-18)
- **v0.2.0 Security Hardening** - Phases 9-13 (shipped 2026-01-18)
- **v0.3.0 Mobile & Polish** - Phases 14-20 (shipped 2026-01-19)
- **v0.4.0 Files, Theming & Notes** - Phases 21-23 (shipped 2026-01-20)
- **v0.5.0 Feature Completeness** - Phases 24-29 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (24, 25, 26...): Planned milestone work
- Decimal phases (24.1, 24.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 24: Quick Wins** - Typing indicators, channel archiving, channel categories (completed with gaps)
- [x] **Phase 25: Job Queue Foundation** - BullMQ infrastructure, scheduled messages, reminders
- [ ] **Phase 26: Collections & Presence** - Bookmarks/saved messages, user status messages
- [x] **Phase 27: Rich Content** - Link previews/unfurling, custom emoji
- [x] **Phase 28: Authorization & Analytics** - User groups, guest accounts, workspace analytics
- [ ] **Phase 29: Stabilization** - Testing, bug fixes, performance verification

## Phase Details

### Phase 24: Quick Wins

**Goal**: Users can see typing activity, organize channels into categories, and archive inactive channels
**Depends on**: Nothing (standalone features using existing patterns)
**Requirements**: TYPE-01, TYPE-02, TYPE-03, TYPE-04, TYPE-05, ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06, CCAT-01, CCAT-02, CCAT-03, CCAT-04, CCAT-05, CCAT-06
**Success Criteria** (what must be TRUE):
  1. User sees "[Name] is typing..." indicator when another user composes a message in the same channel
  2. User can archive a channel, making it read-only and hidden from the main sidebar
  3. User can browse and search archived channels and unarchive them
  4. Admin can create channel categories and assign channels to them
  5. User can collapse/expand categories and drag channels between them in sidebar
**Plans**: 4 plans
Plans:
- [ ] 24-01-PLAN.md - Typing indicators (backend + frontend)
- [ ] 24-02-PLAN.md - Channel archiving (schema + actions + UI)
- [ ] 24-03-PLAN.md - Channel categories (schema + dnd-kit + sidebar)
- [ ] 24-04-PLAN.md - Verification checkpoint

### Phase 25: Job Queue Foundation

**Goal**: Users can schedule messages for future delivery and set reminders on messages
**Depends on**: Phase 24 (BullMQ infrastructure enables async processing)
**Requirements**: SCHD-01, SCHD-02, SCHD-03, SCHD-04, SCHD-05, SCHD-06, SCHD-07, RMND-01, RMND-02, RMND-03, RMND-04, RMND-05, RMND-06, RMND-07
**Success Criteria** (what must be TRUE):
  1. User can compose a message and schedule it for a specific date/time with timezone awareness
  2. User can view, edit, and cancel scheduled messages before they send
  3. User can set a reminder on any message to be notified at a chosen time
  4. User can view pending reminders, snooze them when they fire, and mark them complete
  5. Scheduled messages and reminders survive server restarts (persistent job queue)
**Plans**: 5 plans
Plans:
- [ ] 25-01-PLAN.md - BullMQ infrastructure (queues, worker entry point, npm scripts)
- [ ] 25-02-PLAN.md - Database schema (scheduled_messages, reminders tables)
- [ ] 25-03-PLAN.md - Scheduled messages feature (UI + actions + worker)
- [ ] 25-04-PLAN.md - Reminders feature (UI + actions + worker + notifications)
- [ ] 25-05-PLAN.md - Verification checkpoint

### Phase 26: Collections & Presence

**Goal**: Users can save messages for later and set custom status messages visible to teammates
**Depends on**: Phase 25 (status expiration can use BullMQ for auto-clear)
**Requirements**: BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-05, STAT-01, STAT-02, STAT-03, STAT-04, STAT-05, STAT-06
**Success Criteria** (what must be TRUE):
  1. User can save any message or file to a personal saved list
  2. User can view all saved items and click to jump to original context
  3. User can set custom status with emoji and text, visible next to their name throughout the app
  4. User can set status expiration (auto-clear) and use preset status options
  5. User can enable DND mode that pauses notifications while status is active
**Plans**: 6 plans
Plans:
- [ ] 26-01-PLAN.md - Database schema (bookmarks, user_statuses tables, status expiration queue)
- [ ] 26-02-PLAN.md - Server actions (bookmark CRUD, status CRUD, status expiration worker)
- [ ] 26-03-PLAN.md - DND integration (push and Socket.IO notification blocking)
- [ ] 26-04-PLAN.md - Bookmarks UI (bookmark button, saved items page, sidebar link)
- [ ] 26-05-PLAN.md - Status UI (status editor, status display, sidebar integration)
- [ ] 26-06-PLAN.md - File bookmarks and verification checkpoint

### Phase 27: Rich Content

**Goal**: Messages display link previews automatically and users can upload custom workspace emoji
**Depends on**: Phase 25 (link preview fetching uses BullMQ for async processing)
**Requirements**: LINK-01, LINK-02, LINK-03, LINK-04, LINK-05, LINK-06, LINK-07, EMOJ-01, EMOJ-02, EMOJ-03, EMOJ-04, EMOJ-05, EMOJ-06, EMOJ-07, EMOJ-08
**Success Criteria** (what must be TRUE):
  1. URLs in messages automatically display Open Graph preview cards (title, description, image)
  2. Link previews are cached for performance and internal URLs are blocked (SSRF protection)
  3. User can upload custom emoji images including animated GIFs
  4. Custom emoji appear in emoji picker and can be used in messages and reactions
  5. SVG uploads are converted to PNG for XSS protection
**Plans**: 6 plans
Plans:
- [ ] 27-01-PLAN.md - Database schema (link_previews, custom_emojis tables)
- [ ] 27-02-PLAN.md - Link preview worker (URL extraction, SSRF protection, BullMQ)
- [ ] 27-03-PLAN.md - Link preview UI (card component, message integration)
- [ ] 27-04-PLAN.md - Custom emoji backend (upload endpoint, SVG conversion)
- [ ] 27-05-PLAN.md - Emoji picker replacement (emoji-mart, custom emoji support)
- [ ] 27-06-PLAN.md - Emoji management UI and verification checkpoint

### Phase 28: Authorization & Analytics

**Goal**: Admins can create user groups for mentions, invite guest users with limited access, and view workspace usage metrics
**Depends on**: Phase 27 (guest restrictions interact with all features)
**Requirements**: UGRP-01, UGRP-02, UGRP-03, UGRP-04, UGRP-05, UGRP-06, GUST-01, GUST-02, GUST-03, GUST-04, GUST-05, GUST-06, GUST-07, GUST-08, ANLY-01, ANLY-02, ANLY-03, ANLY-04, ANLY-05, ANLY-06, ANLY-07, ANLY-08
**Success Criteria** (what must be TRUE):
  1. Admin can create user groups with @handles that notify all members when mentioned
  2. Admin can invite external users as guests with access restricted to specific channels only
  3. Guest badge is visible on profiles; guests cannot see full member directory or join user groups
  4. Admin can set guest expiration dates for automatic deactivation
  5. Admin dashboard shows aggregate workspace metrics (message volume, active users, channel activity, storage usage)
**Plans**: 8 plans
Plans:
- [x] 28-01-PLAN.md - Database schema (user_groups, guest tables, members extension)
- [x] 28-02-PLAN.md - Analytics foundation (shadcn chart/tabs, server actions)
- [x] 28-03-PLAN.md - User group backend (CRUD actions, mention system extension)
- [x] 28-04-PLAN.md - Guest backend (invite links, expiration worker, access control)
- [x] 28-05-PLAN.md - User groups UI (settings page, mention autocomplete tabs)
- [x] 28-06-PLAN.md - Guest UI (settings page, invite flow, badge components)
- [x] 28-07-PLAN.md - Analytics dashboard (charts, metrics, export)
- [x] 28-08-PLAN.md - Verification checkpoint

### Phase 29: Stabilization

**Goal**: All v0.5.0 features are thoroughly tested, bugs are fixed, and the platform is production-ready
**Depends on**: Phase 28 (all features complete before stabilization)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08
**Success Criteria** (what must be TRUE):
  1. Unit tests exist for all new v0.5.0 backend services
  2. Integration tests verify cross-feature interactions (e.g., guests cannot use user group mentions)
  3. Socket.IO event tests cover real-time features (typing indicators at scale)
  4. All bugs discovered during testing are fixed or documented for future
  5. Performance testing confirms typing indicators work at 500+ concurrent users
**Plans**: 12 plans
Plans:
- [ ] 29-01-PLAN.md — Fix H-1, M-1, M-7 (notes, typing, presence auth)
- [ ] 29-02-PLAN.md — Fix M-8, M-9, M-10 (user status, group, link preview auth)
- [ ] 29-03-PLAN.md — Fix M-2, M-3, M-11 (thread race, limits, pagination)
- [ ] 29-04-PLAN.md — Fix M-12, M-13 (unbounded arrays, notification limits)
- [ ] 29-05-PLAN.md — BUG-26-01 user status persistence fix
- [ ] 29-06-PLAN.md — Low severity quick fixes (L-4, L-5, L-6, L-7)
- [ ] 29-07-PLAN.md — Tests for socket handler auth fixes (H-1, M-1, M-7)
- [ ] 29-08-PLAN.md — Tests for action auth fixes (M-8, M-9, M-10)
- [ ] 29-09-PLAN.md — Tests for thread handler fixes (M-2, M-3, M-11)
- [ ] 29-10-PLAN.md — Tests for v0.5.0 server actions (scheduled messages, reminders, bookmarks)
- [ ] 29-11-PLAN.md — Tests for guests and analytics actions
- [ ] 29-12-PLAN.md — Verification checkpoint

**Known Bugs (from earlier phases):**
- BUG-26-01: User status not persisting after save (see `.planning/todos/pending/2026-01-21-phase26-status-bugs.md`)

**Deferred from CODE_REVIEW_04.MD:**
- L-1: Audit log streaming (requires rewrite)
- L-2: Admin export batching (requires job-based export)
- L-3: Distributed rate limiting (requires Redis rate limiter)
- M-4: Attachment auth (needs design decision)
- M-5: Upload quotas (needs design decision)
- M-6: CSP hardening (needs deployment config)

## Progress

**Execution Order:**
Phases execute in numeric order: 24 -> 24.1 (if inserted) -> 25 -> 26 -> 27 -> 28 -> 29

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 24. Quick Wins | 4/4 | Complete (gaps) | 2026-01-20 |
| 25. Job Queue Foundation | 5/5 | Complete | 2026-01-21 |
| 26. Collections & Presence | 6/6 | Complete (gaps) | 2026-01-21 |
| 27. Rich Content | 6/6 | Complete | 2026-01-21 |
| 28. Authorization & Analytics | 8/8 | Complete | 2026-01-21 |
| 29. Stabilization | 0/12 | Not started | - |

## Coverage

**Requirements by Phase:**

| Phase | Requirements | Count |
|-------|--------------|-------|
| 24. Quick Wins | TYPE-01 to TYPE-05, ARCH-01 to ARCH-06, CCAT-01 to CCAT-06 | 17 |
| 25. Job Queue Foundation | SCHD-01 to SCHD-07, RMND-01 to RMND-07 | 14 |
| 26. Collections & Presence | BOOK-01 to BOOK-05, STAT-01 to STAT-06 | 11 |
| 27. Rich Content | LINK-01 to LINK-07, EMOJ-01 to EMOJ-08 | 15 |
| 28. Authorization & Analytics | UGRP-01 to UGRP-06, GUST-01 to GUST-08, ANLY-01 to ANLY-08 | 22 |
| 29. Stabilization | TEST-01 to TEST-08 | 8 |
| **Total** | | **87** |

All 87 v1 requirements mapped. No orphans.

---
*Roadmap created: 2026-01-20*
*Last updated: 2026-01-21 (Phase 29 planned)*

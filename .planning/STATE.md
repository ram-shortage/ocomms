# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-21)

**Core value:** Data sovereignty - complete control over communication data
**Current focus:** v0.6.0 Polish & Hardening - Phase 32 Medium/Low Security

## Current Position

Phase: 32 of 36 (Medium/Low Security)
Plan: 7 of 7 in current phase
Status: Phase complete
Last activity: 2026-01-23 - Completed 32-07-PLAN.md (Orphan Cleanup & SRI)

Progress: [██████████████████████░░░] 32/36 phases

## Shipped Milestones

- **v0.5.0 Feature Completeness** - 2026-01-21
  - 6 phases (24-29), 41 plans, 87 requirements
  - See: .planning/milestones/v0.5.0-ROADMAP.md

- **v0.4.0 Files, Theming & Notes** - 2026-01-20
  - 3 phases (21-23), 9 plans, 22 requirements

- **v0.3.0 Mobile & Polish** - 2026-01-19
  - 7 phases (14-20), 23 plans, 38 requirements

- **v0.2.0 Security Hardening** - 2026-01-18
  - 5 phases (9-13), 24 plans, 19 requirements

- **v0.1.0 Full Conversation** - 2026-01-18
  - 8 phases (1-8), 23 plans, 51 requirements

## Performance Metrics

**Cumulative (through Phase 31):**
- Total plans completed: 135
- Total requirements delivered: 230
- Total phases completed: 31

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Recent from Phase 32:
- Bloom filter with 100 common passwords (minimal memory, catches worst offenders) (SEC2-09)
- Breach warning dismissable, password reuse hard block (SEC2-09, SEC2-20)
- All 5 history entries compared regardless of match (timing attack prevention)
- 1GB default storage quota per user with 80% warning, 100% block (SEC2-10)
- 24-hour grace period for orphaned attachment cleanup (avoids deleting in-progress uploads)
- Daily cleanup at 3 AM (low traffic time, once daily sufficient)
- SHA-384 for SRI hashes (industry standard balance of security and performance)
- Client-side returnUrl validation only allows relative URLs (no domain checking in browser)
- Block direct IP addresses in link previews to force DNS resolution path
- Two-layer SSRF protection: isUrlSafe() before queue, request-filtering-agent at fetch
- Pino with pino-pretty for dev, JSON for production (structured logging)
- 10% sampling for API request logging in production (reduce volume)
- Safe error messages shown in both dev and prod modes (Unauthorized, Not found, etc.)
- Socket.IO CORS via origin callback with env-based whitelist (SEC2-13)
- Guest disconnect uses same-process IO instance access (SEC2-16)

Recent from Phase 31:
- 30 events/sec rate limit with 5sec cooldown (lenient for normal usage, blocks abuse)
- Rate limit by userId not socket.id (same user on multiple tabs shares limit)
- Preserve ZWJ (U+200D) for emoji sequences - family/professional emoji work correctly
- Replace dangerous chars with visible placeholder (U+25A1) rather than silent removal
- Standardize 403 error to "Not authorized" (same for not-found and not-member)
- Export endpoint derives org from session ownership, not request body

### Pending Todos

5 todos pending - see `.planning/todos/pending/`
- Fix channel category drag-drop (addressed in SIDE-02 to SIDE-04)
- Reorder sidebar sections (addressed in SIDE-06)
- Fix typing bar layout whitespace
- Phase 26 status bugs (can be closed)
- Load testing typing indicators (descoped)

### Deferred Tech Debt

From v0.5.0 (some addressed in v0.6.0):
- CSP hardening (addressed in SEC2-01) ✓
- Attachment auth / Upload quotas (addressed in SEC2-10)

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-01-23
Stopped at: Completed 32-07-PLAN.md (Phase 32 complete)
Resume file: None

## Human Verification Deferred

Phase 30 manual testing deferred to milestone audit:
- CSP header verification (nonce rotation, no console violations)
- Session revocation immediate effect (multi-browser test)
- Password change session revocation
- SVG upload rejection through UI
- SVG MIME spoofing protection

Phase 31 manual testing deferred to milestone audit:
- Socket.IO rate limit toast appearance
- Mobile DM page layout
- Profile page responsive spacing
- Channel header overflow menu on mobile
- Workspace name tooltip on hover
- Mobile nav highlighting across routes

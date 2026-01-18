# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** Data sovereignty - complete control over communication data
**Current focus:** Phase 16 - Message Caching

## Current Position

Phase: 16 of 20 (Message Caching)
Plan: 0 of TBD in current phase
Status: Ready to discuss/plan
Last activity: 2026-01-18 - Phase 15 verified and complete

Progress: [############............] 75% (15/20 phases)

## Shipped Milestones

- **v0.2.0 Security Hardening** - 2026-01-18
  - 5 phases (9-13), 24 plans, 19 requirements
  - See: .planning/milestones/v0.2.0-ROADMAP.md

- **v0.1.0 Full Conversation** - 2026-01-18
  - 8 phases, 23 plans, 51 requirements
  - See: .planning/milestones/v0.1.0-ROADMAP.md

## Performance Metrics

**Cumulative:**
- Total plans completed: 53 (23 + 24 + 3 + 3)
- Total requirements delivered: 84 (51 + 19 + 8 + 6)
- Total phases completed: 15

**v0.3.0 Target:**
- Phases: 7 (14-20)
- Requirements: 38

## Accumulated Context

### Decisions (Phase 15)

| Decision | Rationale | Plan |
|----------|-----------|------|
| Use Serwist for Next.js SW integration | Maintained Workbox fork, works with App Router | 15-01 |
| Add turbopack: {} for Next.js 16 | Acknowledges webpack plugin while allowing Turbopack | 15-01 |
| Disable Serwist in development | Avoids stale cache issues during dev | 15-01 |
| Use --webpack flag for production builds | Turbopack doesn't support Serwist, webpack required for SW generation | 15-02 |
| skipWaiting: false for user-controlled updates | User decides when to apply SW updates | 15-02 |
| useSyncExternalStore for browser APIs | Avoids setState in effects lint errors, proper SSR handling | 15-03 |
| Engagement threshold: 3 pages OR 30 seconds | Per CONTEXT.md, shows install prompt after meaningful engagement | 15-03 |

### Decisions (Phase 14)

| Decision | Rationale | Plan |
|----------|-----------|------|
| SECFIX-02: Middleware fails closed | Redirect to /login on validation error | 14-01 |
| SECFIX-04: getChannel returns null for non-org-members | Prevents revealing channel existence | 14-01 |
| SECFIX-08: Audit logger uses async fs/promises | Non-blocking writes | 14-01 |
| Rate limit: 10 messages/60s | Balance UX with spam prevention | 14-02 |
| Message length: 10,000 chars | Per CONTEXT.md decision | 14-02 |
| Sequence retry: 3 attempts | Handle race conditions gracefully | 14-02 |
| Error codes for client | RATE_LIMITED, MESSAGE_TOO_LONG | 14-02 |
| @mention org-scoped | innerJoin members table | 14-03 |
| Character counter always visible | Per CONTEXT.md decision | 14-03 |
| Socket error code/retryAfter | Typed rate limit handling | 14-03 |

### Pending Todos

Items carried from previous milestones (now addressed in v0.3.0):
- Complete USER-SETUP.md (UIPOL-05)
- Add sidebar navigation links for /threads and /search (UIPOL-01)
- Increase HSTS max-age to 31536000 (UIPOL-06)
- Add logout button to UI (UIPOL-02)
- Create audit log viewer UI (UIPOL-03)
- Create data export UI (UIPOL-04)

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-01-18
Stopped at: Phase 15 verified complete, ready for Phase 16
Resume file: None

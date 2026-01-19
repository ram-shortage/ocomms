# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** Data sovereignty - complete control over communication data
**Current focus:** Phase 16 - Message Caching

## Current Position

Phase: 16 of 20 (Message Caching)
Plan: 2 of 2 in current phase (COMPLETE)
Status: Phase complete
Last activity: 2026-01-19 - Completed 16-02-PLAN.md (Cache Integration)

Progress: [################........] 80% (16/20 phases)

## Shipped Milestones

- **v0.2.0 Security Hardening** - 2026-01-18
  - 5 phases (9-13), 24 plans, 19 requirements
  - See: .planning/milestones/v0.2.0-ROADMAP.md

- **v0.1.0 Full Conversation** - 2026-01-18
  - 8 phases, 23 plans, 51 requirements
  - See: .planning/milestones/v0.1.0-ROADMAP.md

## Performance Metrics

**Cumulative:**
- Total plans completed: 56 (23 + 24 + 3 + 3 + 2 + 1)
- Total requirements delivered: 84 (51 + 19 + 8 + 6)
- Total phases completed: 16

**v0.3.0 Target:**
- Phases: 7 (14-20)
- Requirements: 38

## Accumulated Context

### Decisions (Phase 16)

| Decision | Rationale | Plan |
|----------|-----------|------|
| Use Dexie.js for IndexedDB wrapper | Provides React hooks and TypeScript support | 16-01 |
| Compound indexes [channelId+sequence] | Enables efficient ordered message queries | 16-01 |
| 7-day TTL with cachedAt field | Matches Safari ITP policy, enables cleanup queries | 16-01 |
| Graceful error handling for cache ops | IndexedDB fails in private browsing, app should continue | 16-01 |
| useLiveQuery for reactive cache queries | Auto re-renders when IndexedDB changes, including from other tabs | 16-02 |
| Fire-and-forget cache writes | Don't block UI rendering on cache operations | 16-02 |
| Normalize cached messages for display | Reconstruct author object from flattened fields | 16-02 |
| PWAProvider for cache initialization | Already handles PWA lifecycle, cache is a PWA concern | 16-02 |

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

Last session: 2026-01-19
Stopped at: Completed 16-02-PLAN.md (Cache Integration) - Phase 16 complete
Resume file: None

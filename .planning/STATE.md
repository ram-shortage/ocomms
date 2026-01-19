# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** Data sovereignty - complete control over communication data
**Current focus:** Phase 19 - Mobile Layout

## Current Position

Phase: 19 of 20 (Mobile Layout)
Plan: 3 of 3 in current phase
Status: Phase complete
Last activity: 2026-01-19 - Completed 19-03-PLAN.md (Touch Interactions)

Progress: [###################.....] 95% (19/20 phases)

## Shipped Milestones

- **v0.2.0 Security Hardening** - 2026-01-18
  - 5 phases (9-13), 24 plans, 19 requirements
  - See: .planning/milestones/v0.2.0-ROADMAP.md

- **v0.1.0 Full Conversation** - 2026-01-18
  - 8 phases, 23 plans, 51 requirements
  - See: .planning/milestones/v0.1.0-ROADMAP.md

## Performance Metrics

**Cumulative:**
- Total plans completed: 63 (23 + 24 + 3 + 3 + 2 + 4 + 5)
- Total requirements delivered: 90 (51 + 19 + 8 + 6 + 6)
- Total phases completed: 18

**v0.3.0 Target:**
- Phases: 7 (14-20)
- Requirements: 38

## Accumulated Context

### Decisions (Phase 19)

| Decision | Rationale | Plan |
|----------|-----------|------|
| viewportFit: cover for safe-area CSS | Required for env(safe-area-inset-*) functions to work on notched devices | 19-01 |
| interactiveWidget: resizes-content | Improves keyboard handling on Chrome/Firefox, harmless on Safari | 19-01 |
| overscroll-behavior-y: contain globally | Disables browser pull-to-refresh to avoid conflicts with app behavior | 19-01 |
| useIsMobile returns false on SSR | CSS responsive classes handle initial render, hook is for JS logic only | 19-01 |
| dvh instead of vh for containers | Accounts for browser chrome and virtual keyboards on mobile | 19-01 |
| md:hidden/hidden md:block for responsive nav | Sidebar desktop-only, tabs mobile-only at 768px breakpoint | 19-02 |
| pb-16 for tab bar clearance | Main content reserves space for fixed bottom tab bar height | 19-02 |
| Mentions tab routes to /threads | Reuses existing threads page for @mention notifications | 19-02 |
| 44px touch targets on tabs | min-h-11 min-w-11 ensures accessible mobile tap areas | 19-02 |
| 80px pull threshold | Industry standard for pull-to-refresh trigger | 19-03 |
| 2.5 resistance factor | Makes pull feel native, not 1:1 which is too sensitive | 19-03 |
| router.refresh() for pull-to-refresh | Next.js soft refresh re-fetches server data | 19-03 |
| safe-area max() function | pb-[max(1rem,env(safe-area-inset-bottom))] ensures minimum padding | 19-03 |

### Decisions (Phase 18)

| Decision | Rationale | Plan |
|----------|-----------|------|
| VAPID keys in environment variables | Keys generated once and stored, not at runtime | 18-01 |
| Graceful degradation when VAPID unconfigured | Push features disabled but app continues to work | 18-01 |
| Endpoint as unique key for subscriptions | Browser endpoint URL uniquely identifies a subscription | 18-01 |
| Notification tag for deduplication | Same tag replaces existing notification instead of stacking | 18-01 |
| Tab reuse on notification click | Check for existing tabs before opening new window | 18-01 |
| VAPID public key endpoint is public | No auth required since key is public | 18-02 |
| Endpoint reassignment on user switch | Replace old subscription if same endpoint | 18-02 |
| Idempotent subscribe/unsubscribe | Return success even if already subscribed/removed | 18-02 |
| Fire-and-forget push delivery | Non-blocking push sending to not slow down socket emits | 18-03 |
| 24-hour TTL for push messages | Balance between delivery window and staleness | 18-03 |
| Tag-based push deduplication | channel:{id} for mentions, dm:{id} for DMs | 18-03 |
| Auto-cleanup expired subscriptions | 410/404 responses trigger subscription deletion | 18-03 |
| Double-permission pattern | In-app prompt before browser permission for better UX | 18-04 |
| iOS standalone detection | iOS requires PWA installation for push support | 18-04 |
| Unified push subscription hook | Single hook provides all state and controls | 18-04 |
| Push prompt engagement gating | Same threshold as install prompt (3 pages OR 30s) | 18-05 |
| Push prompt localStorage persistence | Dismissal persists to avoid annoying users | 18-05 |
| Separate notification section component | Keeps settings page server-side | 18-05 |

### Decisions (Phase 17)

| Decision | Rationale | Plan |
|----------|-----------|------|
| Dexie version 2 schema for sendQueue | Adds sendQueue table while preserving existing messages | 17-01 |
| Compound index [targetId+status] | Enables efficient pending message queries by channel/conversation | 17-01 |
| AWS-style exponential backoff | baseDelay*2^attempt + jitter prevents thundering herd | 17-01 |
| Default 5 max retries, 30s max delay | Balance between persistence and giving up on permanently failed | 17-01 |
| Graceful error handling for queue ops | Log but don't throw - IndexedDB may fail in private browsing | 17-01 |
| 10 second socket send timeout | Balance between giving up too early and hanging too long | 17-02 |
| Random jitter 0-500ms on socket connect | Prevents thundering herd when server restarts | 17-02 |
| Rate limit errors use server's retryAfter | Respects server's guidance over exponential backoff | 17-02 |
| Cache barrel imports for queue processor | Consistent with existing import patterns | 17-03 |
| _isPending flag on optimistic messages | Enables potential UI styling differentiation | 17-03 |
| Filter pending by serverId match | Prevents duplicate display when server confirms | 17-03 |
| MessageStatus below message content | Subtle text styling for minimal visual impact | 17-04 |
| 70% opacity for pending messages | Visual differentiation without being obtrusive | 17-04 |
| Separate SyncProvider component | Separation of concerns from PWAProvider | 17-04 |

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
Stopped at: Completed 19-03-PLAN.md, Phase 19 complete
Resume file: None

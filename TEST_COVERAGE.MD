# Test Coverage Gaps (as of 2026-01-19)

## Current tests present
- Functional e2e: `tests/functional.test.ts` (requires running stack + seeded DB).
- Unit tests:
  - `src/server/socket/__tests__/authz.test.ts` (authz helpers).
  - `src/app/api/upload/avatar/__tests__/route.test.ts` (file signature helper only).

## Coverage gaps

### API routes (most are untested)
- No tests for admin endpoints: `/api/admin/export`, `/api/admin/audit-logs`.
- No tests for push endpoints: `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/vapid-public`.
- No tests for channels endpoints: pins + notification settings endpoints.
- No tests for auth flow endpoints beyond functional signup/signin (e.g., password reset, email verification, lockout flows, rate limits).
- No tests for `upload/avatar` route behavior end-to-end (auth required, size limits, storage path, DB update).

### Socket.IO handlers (mostly untested)
- No tests for:
  - message send/delete, rate limiting, size checks, sequence generation.
  - thread replies (authz, nested thread prevention, sequence handling, reply count updates).
  - reactions (toggle/get authz and payload correctness).
  - notifications (mention parsing and delivery, per-channel settings).
  - unread counts (mark read/unread, cache invalidation).
  - presence events (set active/away, fetch, org membership checks).

### Data access & business logic
- No unit tests for server actions in `src/lib/actions/*` (channels, conversations, search, admin unlock).
- No tests for mention parsing / formatting (`src/lib/mentions.ts`).
- No tests for audit logging and retention cleanup.

### Security / authorization / tenancy isolation
- No tests verifying org/room membership is enforced across API + socket handlers.
- No negative tests for cross-tenant data access (e.g., search, pins, notifications, exports).
- No tests for authz failures in middlewares and socket middleware.
- No tests for rate limit behavior across multiple requests/nodes.

### Data integrity & concurrency
- No tests for race conditions (message sequencing, thread reply sequencing, pin conflicts).
- No tests for idempotency (reactions toggle, notification settings updates, join/leave flows).

### UI / UX / accessibility
- No component/unit tests for React UI (message list, thread panel, mention autocomplete, notifications).
- No accessibility tests (ARIA, keyboard navigation, focus management).

### Offline / PWA / service worker
- No tests for offline queueing, background sync, cache behavior, or service worker updates.

### Performance / load
- No tests for large-channel history pagination, search performance, or export/audit log scaling.
- No load or soak testing for Socket.IO or Redis-backed presence/unread.

## Suggested priorities
1) Auth/authz tests for key API + socket routes (cross-tenant isolation).
2) Message + thread handlers: limits, sequencing, and concurrency.
3) Admin export/audit logs: streaming/pagination + authorization.
4) Offline queue + PWA behavior.
5) UI regression coverage for core workflows (messaging, threads, mentions).

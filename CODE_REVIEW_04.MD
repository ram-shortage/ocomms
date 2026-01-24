# Code Review 04

## Findings (ordered by severity)

### High
- [H-1] Notes socket rooms lack authorization checks (subscribe/broadcast)
  - Evidence: `src/server/socket/handlers/notes.ts:29`, `src/server/socket/handlers/notes.ts:62`
  - Impact: Any authenticated user can join arbitrary channel note rooms and receive update metadata (channelId/version/updatedBy), or broadcast spoofed updates to rooms they don’t belong to.
  - Recommendation: Require channel membership for `channelId` note rooms and workspace membership for `workspaceId` personal rooms before join/broadcast; reuse `isChannelMember`/`isOrganizationMember` checks similar to `room:join`.

### Medium
- [M-1] Presence lookup lacks organization membership enforcement
  - Evidence: `src/server/socket/index.ts:184`
  - Impact: Any authenticated user can request presence for any workspaceId/userIds, leaking online status across organizations.
  - Recommendation: Validate org membership before servicing `presence:fetch` (or require `socket.data.workspaceId` set by a prior authorized `workspace:join`).

- [M-2] Thread reply sequence generation is race-prone
  - Evidence: `src/server/socket/handlers/thread.ts:73`, `src/db/schema/message.ts:38`
  - Impact: Concurrent thread replies can compute the same sequence, tripping unique constraints and failing the insert (lost replies / user-facing errors).
  - Recommendation: Mirror the main message insert strategy (single-statement `MAX()+1` with retry on 23505) or move to a transaction/sequence.

- [M-3] Thread replies bypass message length limits and rate limiting
  - Evidence: `src/server/socket/handlers/thread.ts:16`, `src/server/socket/handlers/message.ts:14`, `src/server/socket/handlers/message.ts:41`
  - Impact: Users can post oversized or high‑volume thread replies even if channel messages are rate‑limited, enabling spam/DoS within threads.
  - Recommendation: Reuse `MAX_MESSAGE_LENGTH` validation and apply a rate limiter to thread replies.

- [M-4] Attachments are publicly reachable without auth
  - Evidence: `src/app/api/upload/attachment/route.ts:56`, `src/middleware.ts:8`
  - Impact: Uploaded files land under `/public/uploads` and the middleware explicitly skips `/uploads`, so anyone with the URL can access attachments from private channels or DMs.
  - Recommendation: Serve attachments through an authenticated route (or signed URLs) and remove `/uploads` from `skipPaths` for private content.

- [M-5] Upload endpoints lack abuse controls (rate/quotas)
  - Evidence: `src/app/api/upload/attachment/route.ts:31`, `src/app/api/upload/avatar/route.ts:60`
  - Impact: Authenticated users can repeatedly upload until disk is exhausted, impacting availability.
  - Recommendation: Add per‑user/IP rate limits and storage quotas; consider background cleanup for orphaned attachments.

- [M-6] CSP allows inline/eval scripts in production nginx config
  - Evidence: `nginx/conf.d/default.conf:43`
  - Impact: `'unsafe-inline'` and `'unsafe-eval'` substantially weaken XSS protections and make CSP less effective for a sensitive chat app.
  - Recommendation: Remove unsafe directives and use hashed/nonced scripts compatible with Next.js production builds.

- [M-7] Typing events broadcast without channel/DM authorization
  - Evidence: `src/server/socket/handlers/typing.ts:25-63`
  - Impact: Any authenticated user can emit typing indicators into arbitrary channel/DM rooms they don’t belong to, enabling spoofing/harassment and UI noise.
  - Recommendation: Validate membership/participation (e.g., `isChannelMember` / `isConversationParticipant`) before broadcasting or ignore events unless the socket is in the target room.

- [M-8] User status lookup lacks authentication/organization scoping
  - Evidence: `src/lib/actions/user-status.ts:138-143`, `src/components/status/status-indicator.tsx:1-45`
  - Impact: Any authenticated user can request status (emoji/text) for arbitrary user IDs, including outside their workspace, which is a privacy leak.
  - Recommendation: Require a session and verify shared organization membership (or restrict to self) before returning status.

- [M-9] Group member list exposes users across organizations
  - Evidence: `src/lib/actions/user-group.ts:346-365`
  - Impact: Any authenticated user can enumerate members (including emails) for any group ID, even outside their workspace.
  - Recommendation: Verify requester is in the group’s organization and limit fields for non-admins (e.g., hide emails).

- [M-10] Link preview fetch lacks access control to message
  - Evidence: `src/lib/actions/link-preview.ts:24-49`
  - Impact: Any authenticated user can fetch link previews for arbitrary message IDs, leaking URLs/titles from private channels or DMs.
  - Recommendation: Check message context and enforce channel membership/DM participation before returning previews.

- [M-11] Thread reply fetch returns unbounded result set
  - Evidence: `src/server/socket/handlers/thread.ts:215-270`
  - Impact: Large threads can return thousands of replies in a single socket response, causing high DB load and oversized payloads (DoS vector).
  - Recommendation: Add pagination (limit + cursor/offset) with a reasonable max page size.

- [M-12] Presence/unread fetch accept unbounded ID lists
  - Evidence: `src/server/socket/index.ts:188-204`, `src/server/socket/handlers/unread.ts:401-427`
  - Impact: Clients can pass very large `userIds`/`channelIds`/`conversationIds`, triggering large Redis pipelines and many DB queries in a single request.
  - Recommendation: Enforce maximum list sizes, reject or trim oversized requests, and batch queries where possible.

- [M-13] notification:fetch has no limit cap and uses N+1 channel lookups
  - Evidence: `src/server/socket/handlers/notification.ts:375-412`
  - Impact: A client can request extremely large limits, leading to heavy DB reads and per-channel queries, increasing latency and load.
  - Recommendation: Clamp `limit` (e.g., <=100), add pagination, and fetch channel metadata in a single query (e.g., `inArray`).

### Low
- [L-1] Audit log API reads entire log files into memory before filtering
  - Evidence: `src/app/api/admin/audit-logs/route.ts:63`, `src/app/api/admin/audit-logs/route.ts:166`
  - Impact: Large log ranges can cause high memory usage and slow responses (admin‑triggered DoS). Pagination only applies after loading everything.
  - Recommendation: Stream log files line‑by‑line and apply filters/pagination during read.

- [L-2] Admin export is fully in‑memory and N+1 heavy
  - Evidence: `src/app/api/admin/export/route.ts:94`, `src/app/api/admin/export/route.ts:135`
  - Impact: Large organizations can cause long‑running requests, timeouts, and high memory usage.
  - Recommendation: Implement streaming export (NDJSON/zip), batch queries, and async job-based exports.

- [L-3] Message rate limiting is per‑node only
  - Evidence: `src/server/socket/handlers/message.ts:16`
  - Impact: In a multi‑instance deployment (Redis adapter enabled), users can bypass limits by hitting different nodes.
  - Recommendation: Use a shared rate limiter backend (Redis) or move rate limiting to the API gateway.

- [L-4] Group handle lookup is unauthenticated and unscoped
  - Evidence: `src/lib/actions/user-group.ts:371-391`
  - Impact: Group existence and member counts can be enumerated for arbitrary organizations if IDs/handles are known.
  - Recommendation: Require session + org membership before resolving handles; consider returning only minimal data.

- [L-5] Personal notes API doesn’t verify workspace membership
  - Evidence: `src/app/api/notes/personal/route.ts:13-164`
  - Impact: Users can create/read notes for arbitrary workspace IDs, allowing data bloat and potential workspace ID probing.
  - Recommendation: Validate that the caller is a member of the workspace before read/write.

- [L-6] Pinned messages API uses N+1 author lookups
  - Evidence: `src/app/api/channels/[channelId]/pins/route.ts:62-80`
  - Impact: Channels with many pins trigger one query per author, increasing latency and DB load.
  - Recommendation: Replace per-author lookups with a single `inArray` query or join.

- [L-7] Notification fan-out performs per-user settings queries
  - Evidence: `src/server/socket/handlers/notification.ts:18-92`, `src/server/socket/handlers/notification.ts:126-259`
  - Impact: @channel/@here in large channels cause one settings query per member, which is expensive and can be abused for load spikes.
  - Recommendation: Batch-fetch notification settings for all relevant users and apply defaults in memory.

## Open questions / assumptions
- Are attachments intentionally meant to be publicly linkable, or should they inherit channel/DM access controls?
- Is the app expected to scale beyond a single instance? If yes, shared rate limiting and streaming exports/logs become more important.

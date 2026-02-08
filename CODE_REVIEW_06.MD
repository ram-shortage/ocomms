**Findings**
- High: Socket auth never checks the Redis revocation store, so “logout all devices”/revoked sessions can still use WebSockets until cookie expiry; add a `validateSession` check after `auth.api.getSession` and fail the handshake on revocation. `src/server/socket/middleware/auth.ts:22`, `src/lib/security/session-store.ts:115`
- High: Attachments are written under `public/uploads` and `/uploads` is skipped by middleware, so any user with the URL can fetch files without auth or security headers; for a sovereign Slack‑like system this is a privacy leak. `src/app/api/upload/attachment/route.ts:90`, `src/app/api/upload/attachment/route.ts:100`, `src/middleware.ts:68`
- Medium: Quota enforcement is non‑atomic (check then update), so concurrent uploads can bypass limits and undercount usage, risking disk exhaustion; switch to a single atomic UPDATE/RETURNING (or a transaction with row lock). `src/lib/security/storage-quota.ts:32`, `src/lib/security/storage-quota.ts:49`
- Medium: Message rate‑limiter “fallback” to memory won’t trigger if Redis is down because `createRedisClient()` doesn’t throw; you’ll still build `RateLimiterRedis` and `.consume()` will fail, effectively blocking messages under Redis outages. `src/server/socket/handlers/message.ts:97`
- Low: `node-fetch` is imported directly but not declared as a dependency; it’s currently pulled transitively via `unfurl.js`, which can break on pnpm or dependency churn. Add a direct dependency or move to global `fetch` with explicit size/timeout handling. `src/workers/link-preview.worker.ts:34`, `package.json:31`

**Simplify / optimize (keep security)**
- Consolidate message send queries (membership, org, author, guest status, workspace members) into fewer joined queries or a transaction to cut round‑trips while keeping the same auth checks. `src/server/socket/handlers/message.ts:166`
- Replace `MAX(sequence)+1` with an atomic per‑channel/per‑conversation counter (e.g., `UPDATE … RETURNING`) to avoid hot‑spot scans and retry loops under load. `src/server/socket/handlers/message.ts:204`
- Batch reaction fetches (`reaction:getMany` for message IDs) instead of one socket call per message to reduce socket traffic and server load. `src/components/message/message-list.tsx:188`
- Make non‑core features (link previews, push, PWA offline cache, reminders) toggleable via env flags; this drops worker/Redis load without weakening core auth, rate limiting, or SSRF protections.
- Unify CSP/security headers between Nginx and middleware to avoid conflicting policies and surprises; keep the strict nonce‑based CSP as the source of truth.

**Questions / assumptions**
- Are attachments intended to be private to workspace members? If yes, I’d treat public `/uploads` as a must‑fix.
- Do you want immediate session revocation to apply to WebSockets as well (parity with HTTP middleware)? If yes, I’d hard‑fail socket auth when Redis marks a session invalid.
- Are you targeting pnpm or any non‑npm installers? If yes, the transitive `node-fetch` import will likely break.

Tests not run. If you want, I can propose concrete patches for any of the findings.

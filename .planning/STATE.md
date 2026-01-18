# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-18)

**Core value:** Data sovereignty — complete control over communication data
**Current focus:** Phase 12 — Authentication Hardening

## Current Position

Phase: 12 of 13 (Authentication Hardening)
Plan: 3 of 4 complete (12-01, 12-02, 12-03)
Status: In progress
Last activity: 2026-01-18 — Completed 12-03-PLAN.md (Unlock Flow)

Progress: █████████░ 96% (v0.1.0 complete, v0.2.0 phases 9-11 complete, 12 in progress)

## Shipped Milestones

- **v0.1.0 Full Conversation** — 2026-01-18
  - 8 phases, 23 plans, 51 requirements
  - See: .planning/milestones/v0.1.0-ROADMAP.md

## Performance Metrics

**Velocity:**
- Total plans completed: 19 (v0.2.0)
- Average duration: 3 min
- Total execution time: 49 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 09 | 11/11 | 24min | 2.2min |
| 10 | 3/3 | 7min | 2.3min |
| 11 | 2/2 | 4min | 2min |
| 12 | 3/4 | 14min | 4.7min |

**Recent Trend:**
- Last 5 plans: 11-01 (3min), 11-02 (1min), 12-01 (2min), 12-02 (2min), 12-03 (10min)
- Trend: Stable at ~2-3min/plan (12-03 higher due to better-auth API research)

## Accumulated Context

### Decisions

Key decisions from v0.1.0 are documented in PROJECT.md Key Decisions table.

**v0.2.0 Decisions:**

| Date | Phase | Decision | Rationale |
|------|-------|----------|-----------|
| 2026-01-18 | 09-01 | Added vitest as unit testing framework | Project had no unit test framework; needed for authorization helper tests |
| 2026-01-18 | 09-01 | Mock-based testing for DB operations | Avoids test database dependency, keeps tests fast and isolated |
| 2026-01-18 | 09-02 | Early return pattern for socket authorization | Emit error and return immediately on unauthorized access |
| 2026-01-18 | 09-02 | Log unauthorized attempts | Console logs include user ID and target for security monitoring |
| 2026-01-18 | 09-03 | getMessageContext for join/getReplies, direct parent for reply | Different approaches based on available data in each handler |
| 2026-01-18 | 09-05 | Silent skip for unauthorized read ops | Prevents information disclosure about channel/conversation existence |
| 2026-01-18 | 09-05 | Error emit for unauthorized write ops | Gives users clear feedback when operation is denied |
| 2026-01-18 | 09-04 | Reused getMessageContext for room determination | Eliminated duplicate message query in reaction:toggle handler |
| 2026-01-18 | 09-06 | Duplicate verifyOrgMembership per file | Keeps server actions self-contained, avoids cross-file dependencies |
| 2026-01-18 | 09-09 | Single and() query for ownership check | Simpler and more correct than 2-query approach |
| 2026-01-18 | 09-09 | Create ID arrays before filtering loops | Cleaner org-scoped filtering pattern |
| 2026-01-18 | 09-07 | Standard uniqueIndex over partial indexes | PostgreSQL treats NULLs as distinct in unique indexes |
| 2026-01-18 | 09-08 | Nullable creator columns with onDelete set null | Schema consistency - notNull+set null is contradictory |
| 2026-01-18 | 09-10 | Magic byte validation over MIME type | Client MIME type can be spoofed; magic bytes are actual file content |
| 2026-01-18 | 09-10 | Server-derived file extension | Validated signature determines extension, not client filename |
| 2026-01-18 | 09-11 | Fail-open on middleware validation errors | Prevents lockout; downstream pages re-check anyway |
| 2026-01-18 | 09-11 | 5-minute session validation cache | Balances security (revalidate regularly) with performance (~1ms after first check) |
| 2026-01-18 | 10-02 | 1-hour HSTS max-age initially | Conservative value; increase to 31536000 after production verification |
| 2026-01-18 | 10-02 | Removed external db port exposure | PostgreSQL only accessible within Docker network (security improvement) |
| 2026-01-18 | 10-03 | Production verification deferred | Infrastructure validated locally; full HTTPS verification requires domain deployment |
| 2026-01-18 | 11-01 | CSP allows unsafe-inline/unsafe-eval | Required for Next.js and Tailwind CSS runtime |
| 2026-01-18 | 11-01 | In-memory rate limiting | Appropriate for single-server deployment; Redis for horizontal scaling |
| 2026-01-18 | 12-01 | APIError detection via instanceof Error | better-auth returns Error objects for failed logins in after hooks |
| 2026-01-18 | 12-01 | Vague lockout message for security | "Unable to log in" prevents confirming account existence |
| 2026-01-18 | 12-01 | Preserve lockoutCount on successful login | Enables progressive escalation across multiple lockout cycles |
| 2026-01-18 | 12-02 | zxcvbn dynamic import | 400KB library loaded on first password character to avoid bundle bloat |
| 2026-01-18 | 12-02 | Radix Progress primitive with indicatorClassName | Custom indicator colors per instance while maintaining accessibility |
| 2026-01-18 | 12-03 | requestPasswordReset uses direct fetch | better-auth client doesn't export password reset method |
| 2026-01-18 | 12-03 | Password reset hook queries verification.identifier | better-auth stores tokens as reset-password:{token} in identifier |
| 2026-01-18 | 12-03 | Unlock button visible for all non-self members | Harmless to unlock non-locked user; simpler UX |

### Pending Todos

- Complete USER-SETUP.md (PostgreSQL, SMTP configuration)
- Configure REDIS_URL for production scaling (optional for dev)
- Add sidebar navigation links for /threads and /search pages (tech debt from v0.1.0)
- Verify HTTPS in production after domain deployment (10-03 deferred)
- Increase HSTS max-age to 31536000 after production verification

### Blockers/Concerns

None active.

## Session Continuity

Last session: 2026-01-18T17:58Z
Stopped at: Completed 12-03-PLAN.md (Unlock Flow)
Resume file: None

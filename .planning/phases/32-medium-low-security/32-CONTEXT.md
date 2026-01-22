# Phase 32: Medium/Low Security - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete security hardening with medium and low severity items: password breach checks, user storage quotas, secure cookie prefixes, structured production logging, Socket.IO origin whitelisting, TOTP-based MFA, and orphaned attachment cleanup jobs.

</domain>

<decisions>
## Implementation Decisions

### Password Breach Checking
- Use local bloom filter with common passwords list (no external API calls)
- Check on registration and password change (not on every login)
- Warning only — show specific message but allow if user confirms
- Message: "This password appeared in data breaches. Choose a different one."

### Storage Quotas
- Default quota: 1 GB per user
- Warning at 80% usage, block uploads at 100%
- Usage visibility: on demand (user clicks to view in settings)
- Admins can set per-user overrides (not just workspace-wide)

### MFA Setup Flow
- Admin can require MFA for workspace members (not just optional)
- Recovery: backup codes (10 one-time codes) plus admin can reset
- Require password confirmation before enabling MFA
- MFA setup lives in user profile > security section

### Cleanup & Logging
- Orphaned = message deleted OR upload never attached (both conditions)
- 24-hour grace period before deleting orphaned files
- Production logs: JSON structured format
- Cleanup jobs log detailed activity (each item with identifiers)

### Claude's Discretion
- Bloom filter size and hash parameters
- Exact UI layout for quota display
- Backup code generation algorithm
- Socket.IO origin whitelist configuration approach
- Secure cookie prefix implementation details

</decisions>

<specifics>
## Specific Ideas

- Breach check warning should be dismissible with clear "I understand, use anyway" action
- Quota warning should be non-blocking toast, not modal

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-medium-low-security*
*Context gathered: 2026-01-22*

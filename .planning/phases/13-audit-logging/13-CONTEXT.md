# Phase 13: Audit Logging - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Security event logging for investigation. Login attempts logged with timestamp, IP, user. Admin actions logged. Logs queryable for security investigation.

</domain>

<decisions>
## Implementation Decisions

### Event coverage
- Log all authorization failures (helps detect probing/enumeration attacks)
- Log all data exports (track data leaving the system)
- Log all admin actions (user management, org changes, settings, unlocks)
- Log login and logout only (not token refresh or session expiry)

### Log destination
- Structured log files (JSON lines), not database
- Dedicated /logs directory, separate from app code
- Daily rotation (one file per day)
- 90-day retention (auto-cleanup of older files)

### Query interface
- Direct file access for investigation (grep/jq on log files)
- Read-only API for external tools
- API supports time range + event type filters
- Org admins see their org's events only

### Log format/content
- JSON lines format (one JSON object per line)
- Full IP addresses logged
- User ID only (no email/name in logs, requires lookup)
- Full context on failed attempts (target resource, action attempted)

### Claude's Discretion
- Exact JSON schema for log entries
- Log file naming convention
- Cleanup job implementation (cron, scheduled task, etc.)
- API endpoint design and pagination

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-audit-logging*
*Context gathered: 2026-01-18*

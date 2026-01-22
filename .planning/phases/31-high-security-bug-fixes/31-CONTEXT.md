# Phase 31: High Security + Bug Fixes - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Close high-severity security gaps (Socket.IO rate limiting, Unicode content sanitization, channel notes authorization, audit log integrity, data export scoping) and fix known user-facing bugs (DM mobile layout, profile page spacing, mobile navigation highlighting).

</domain>

<decisions>
## Implementation Decisions

### Rate Limiting Behavior
- Show toast warning ("Slow down") when user hits rate limit
- Lenient limits — allow bursts, only catch extreme abuse (e.g., 30 events/sec)
- Global bucket — single limit across all socket events, not per-event-type
- No escalation — same limit always, resets after cooldown

### Content Sanitization
- Replace Unicode control characters with visible placeholder (□) to show something was there
- No user indication that sanitization occurred — just show clean version
- Allow safe HTML subset in channel notes (bold, links, lists) but strip scripts/styles
- Going forward only — don't retroactively sanitize existing messages

### Bug Fix Approach
- DM mobile layout: Claude investigates and diagnoses specific issue
- Profile page spacing: Claude determines appropriate spacing based on design system
- Mobile nav highlighting: Active nav item should be visually distinct for current route
- Add visual/snapshot regression tests for all bug fixes

### Audit/Export Security
- Audit log tampering: Show visual warning banner in audit log viewer (no admin alert)
- Tampering detection via hash chain — each entry includes hash of previous entry
- Export boundary violation: Return 403 Forbidden AND log attempt as security event
- Channel notes authorization: Strict — deny if any doubt about membership (fail closed)

### Claude's Discretion
- Exact rate limit numbers (within "lenient" guidance)
- Which HTML tags are "safe" for channel notes
- Specific visual regression test implementation
- Hash chain algorithm details

</decisions>

<specifics>
## Specific Ideas

- Rate limit toast should be subtle, not blocking — user can keep working
- Visual warning for tampered audit logs should be prominent but not alarming

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-high-security-bug-fixes*
*Context gathered: 2026-01-22*

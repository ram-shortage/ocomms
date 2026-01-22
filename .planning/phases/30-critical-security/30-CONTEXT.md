# Phase 30: Critical Security - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate critical attack vectors that could compromise application integrity. Focused on three areas: CSP hardening with script nonces, session validation that takes effect immediately, and SVG sanitization to prevent XSS.

</domain>

<decisions>
## Implementation Decisions

### CSP Nonce Strategy
- Balanced approach: nonces for scripts, allow inline styles
- Relaxed CSP in development for debugging, strict in production
- Log violations to server endpoint for analysis
- Self-host all assets — no external resources (fonts, CDNs)

### Session Revocation UX
- Triggers: password change OR explicit "logout all devices" action
- UX: brief toast message, then redirect to login page
- Users can view active sessions with details (device, browser, location, last active)
- Timing: invalidate on next API request (not real-time push)

### SVG Handling Policy
- Block all SVG uploads from users
- No SVGs anywhere — convert system assets to raster too
- Migrate existing SVGs: find and convert all to WebP/PNG
- Format: WebP preferred, PNG fallback for older browsers

### Security Error Messaging
- User-facing: actionable hints ("Session expired, please log in again")
- Server logs: full details (request, user, IP, timestamps, stack traces)
- Rate limiting: silent slowdown after failed auth attempts (no explicit message)
- Admin alerts: notify admins of critical patterns (multiple failed logins, etc.)

### Claude's Discretion
- CSP violation report endpoint implementation
- Exact rate limit thresholds and timing
- Session detail display format
- WebP/PNG generation approach for SVG conversion

</decisions>

<specifics>
## Specific Ideas

- Session list should show enough detail that users can recognize their own devices and spot suspicious sessions
- Toast message for session revocation should be brief — don't leave users confused why they're logged out

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-critical-security*
*Context gathered: 2026-01-22*

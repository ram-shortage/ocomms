# Phase 14: Security Fixes - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden existing code with scoping fixes, input limits, and async improvements. This is defensive work on existing functionality — fixing authorization scoping, validation, race conditions, and limits. No new features.

</domain>

<decisions>
## Implementation Decisions

### Rate Limit Feedback
- Simple message without countdown timer ("Message rate limit reached. Please wait.")
- Display inline below the message input field
- Disable input while rate-limited — user cannot type until limit clears
- Neutral/professional tone

### Error Messaging
- Helpful guidance that tells user what's wrong ("You don't have access to this channel")
- State the issue without suggesting next steps (no "Contact your admin")
- Redirect to dedicated error page (not inline or toast)
- Error pages have "Go home" button only (no back button)

### Input Validation Feedback
- Allow typing beyond limit but disable send button with warning
- Always-visible character counter ("142/10000" format)
- Red counter only when over limit (no red border on input)
- Maximum message size: 10,000 characters

### Organization Scoping UX
- @mention autocomplete shows nothing for non-matching queries (silent empty state)
- Cross-org channel access shows "Access denied" (acknowledge existence, deny access)
- Error page does not reveal channel name ("You don't have access to this channel")
- Same "Access denied" treatment for removed/stale access — consistent experience

### Claude's Discretion
- Exact rate limit duration and recovery behavior
- Error page layout and styling
- Character counter positioning relative to input
- Timing for autocomplete dropdown appearance

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-security-fixes*
*Context gathered: 2026-01-18*

# Phase 29: Stabilization - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Testing and bug-fixing all v0.5.0 features to ensure production readiness. This includes unit tests for backend services, integration tests where cross-feature behavior is obvious, and fixing known bugs. Performance load testing is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Testing scope
- Test all features from phases 24-28 (typing, archiving, categories, BullMQ, scheduled messages, reminders, bookmarks, status, link previews, custom emoji, user groups, guests, analytics)
- Validate and fix all findings from CODE_REVIEW_04.MD (1 high, 13 medium, 7 low severity)
- Fix security vulnerabilities and add unit tests proving each fix works
- Feature tests cover happy path plus error paths (not comprehensive branch coverage)
- Cross-feature integration tests only where they naturally fit (e.g., guests can't use group mentions)

### Bug triage
- Fix all high and medium severity bugs discovered during testing
- Document low severity bugs in ROADMAP.md for future work
- Include existing known bugs in scope (BUG-26-01 status persistence, pending todos for channel categories, typing bar layout)
- Low severity items from CODE_REVIEW_04.MD evaluated case-by-case: quick fixes go in, complex ones defer

### Performance targets
- Skip load testing (no 500-user typing indicator verification)
- Basic manual sanity checks for obviously slow operations
- No automated performance benchmarks

### Claude's Discretion
- Test file organization and naming conventions
- Mocking strategy for external dependencies (Redis, BullMQ)
- Order of fixing security findings vs feature tests
- Which L-1 through L-7 items are "quick fixes" vs "complex"

</decisions>

<specifics>
## Specific Ideas

- CODE_REVIEW_04.MD is the authoritative list of security findings to address
- Security fixes should be paired with unit tests proving the vulnerability is closed
- Existing pending todos in `.planning/todos/pending/` are in scope

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-stabilization*
*Context gathered: 2026-01-21*

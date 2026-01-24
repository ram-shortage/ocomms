# Requirements: OComms v0.6.1

**Defined:** 2026-01-24
**Core Value:** Data sovereignty - complete control over communication data

## v0.6.1 Requirements

Bug fix milestone. Requirements confirmed through production testing in Phase 38.

### Known Bugs (Pre-Discovery)

These bugs were captured prior to production testing:

- [ ] **BUG-01**: Uploads not persisted across container restart (Docker volume missing)
- [ ] **BUG-02**: Uploaded images return 404 errors
- [ ] **BUG-03**: Notification enable popup stays on screen after permission granted
- [x] **BUG-04**: No direct channels access from mobile nav bar — **FIXED**
  - Replaced bottom tab bar with top header + sidebar drawer
  - Hamburger menu opens full sidebar with channels, DMs, search, settings
- [ ] **BUG-05**: Messages render cramped on left side of mobile viewport
  - May need separate CSS fix in message-list component
- [x] **BUG-06**: Mobile nav bar should be at top instead of bottom — **FIXED**
  - New top header with hamburger menu, page title, notifications
  - Sidebar slides in from left as drawer
- [ ] **BUG-07**: Typing bar has excessive whitespace below input

### Discovered Bugs (Phase 38)

- [x] **BUG-08**: Session lost during navigation (CRITICAL - INTERMITTENT) — **FIXED**
  - Root cause: Middleware fail-closed on ANY fetch error (timeout, network, 5xx)
  - Fix applied to `src/middleware.ts`:
    1. Added 5s fetch timeout with retry (was infinite timeout)
    2. Only logout on confirmed invalid sessions (401/403, empty user)
    3. Allow through on transient errors (network, 5xx, Redis issues)

## Deferred

| Bug | Reason |
|-----|--------|
| Realtime chat not updating | Likely Next.js server action manifest issue, needs deeper investigation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | TBD | Pending |
| BUG-02 | TBD | Pending |
| BUG-03 | TBD | Pending |
| BUG-04 | TBD | Pending |
| BUG-05 | TBD | Pending |
| BUG-06 | TBD | Pending |
| BUG-07 | TBD | Pending |

**Coverage:**
- Known bugs: 7 total
- Discovered bugs: 0 (pending Phase 38)
- Mapped to phases: 0 (pending roadmap creation after Phase 38)

---
*Requirements defined: 2026-01-24*
*Last updated: 2026-01-24 — initial definition*

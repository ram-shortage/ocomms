# Roadmap: OComms v0.6.1 Bug Fixes

**Created:** 2026-01-24
**Phases:** 38+ (continues from v0.6.0)
**Approach:** Discovery-first — Phase 38 identifies bugs through production testing, subsequent phases fix them

## Phase Overview

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 38 | Production Testing | Discover and document all production bugs | Discovery | Pending |
| 39+ | Bug Fixes | Fix verified bugs from Phase 38 + known bugs | TBD after Phase 38 | Pending |

## Phase 38: Production Testing & Bug Discovery

**Goal:** Systematically test production features to identify and document all bugs

**Approach:**
1. Claude guides user through key feature areas
2. User tests in production (Chrome browser)
3. Bugs are captured and added to REQUIREMENTS.md
4. Phase completes when all major features tested

**Test Areas:**
- [ ] Authentication flow (login, logout, session)
- [ ] Workspace operations (create, switch, join)
- [ ] Channel operations (create, join, browse, archive)
- [ ] Direct messages (create, send, receive)
- [ ] Messaging (send, edit, delete, reactions, threads)
- [ ] File uploads (images, attachments, previews)
- [ ] Notifications (enable, receive, settings)
- [ ] Mobile experience (navigation, touch targets, layout)
- [ ] Search functionality
- [ ] User settings and profile

**Success Criteria:**
1. All major feature areas tested
2. All discovered bugs documented in REQUIREMENTS.md
3. Bugs categorized by severity (critical, major, minor)
4. Ready for roadmap finalization with fix phases

**Deliverables:**
- Updated REQUIREMENTS.md with discovered bugs
- Updated ROADMAP.md with fix phases

## Phases 39+: Bug Fixes

*Structure TBD after Phase 38 discovery completes*

Anticipated groupings based on known bugs:
- **Infrastructure fixes:** Docker volume for uploads (BUG-01, BUG-02)
- **UI fixes:** Notification popup, typing bar layout (BUG-03, BUG-07)
- **Mobile UX fixes:** Nav bar, channels access, message layout (BUG-04, BUG-05, BUG-06)

---

## Progress Tracking

**Phase 38:** ░░░░░░░░░░ 0%
**Overall:** ░░░░░░░░░░ 0%

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-01-24*

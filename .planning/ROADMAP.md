# Roadmap: OComms v0.6.0

## Overview

v0.6.0 Polish & Hardening addresses security findings from audit, fixes known bugs, and delivers workspace management, sidebar reorganization, and mobile redesign. Security fixes are prioritized by severity (critical first), followed by feature work in logical delivery order.

## Milestones

- **v0.5.0 Feature Completeness** - Phases 24-29 (shipped 2026-01-21)
- **v0.6.0 Polish & Hardening** - Phases 30-36 (in progress)

## Phases

<details>
<summary>v0.5.0 Feature Completeness (Phases 24-29) - SHIPPED 2026-01-21</summary>

See: .planning/milestones/v0.5.0-ROADMAP.md

</details>

### v0.6.0 Polish & Hardening (In Progress)

**Milestone Goal:** Harden security posture, fix known bugs, deliver workspace management, sidebar customization, and mobile improvements.

- [x] **Phase 30: Critical Security** - CSP hardening, session validation, SVG sanitization
- [x] **Phase 31: High Security + Bug Fixes** - Socket.IO rate limiting, content sanitization, authorization fixes, quick bug fixes
- [x] **Phase 32: Medium/Low Security** - Password breach checks, quotas, logging, MFA, cleanup jobs
- [x] **Phase 33: Workspace Management** - Workspace switcher, discovery, join flow
- [x] **Phase 34: Sidebar Reorganization** - Drag-and-drop reordering, user preferences
- [ ] **Phase 35: Mobile Redesign** - Feature accessibility, visual polish
- [ ] **Phase 36: Stabilization** - Integration testing, final polish

## Phase Details

### Phase 30: Critical Security
**Goal**: Eliminate critical attack vectors that could compromise application integrity
**Depends on**: Nothing (first phase of milestone)
**Requirements**: SEC2-01, SEC2-02, SEC2-03
**Success Criteria** (what must be TRUE):
  1. Application loads without inline scripts; all scripts use nonces
  2. Session revocation takes effect immediately (not cached in browser)
  3. SVG uploads cannot execute JavaScript or contain malicious content
**Plans**: 3 plans

Plans:
- [x] 30-01-PLAN.md — CSP nonce implementation with violation reporting
- [x] 30-02-PLAN.md — Redis session validation with immediate revocation
- [x] 30-03-PLAN.md — SVG upload blocking and asset migration

### Phase 31: High Security + Bug Fixes
**Goal**: Close high-severity security gaps and fix known user-facing bugs
**Depends on**: Phase 30
**Requirements**: SEC2-04, SEC2-05, SEC2-06, SEC2-07, SEC2-08, FIX-01, FIX-02, FIX-03, FIX-04, FIX-05
**Success Criteria** (what must be TRUE):
  1. Rapid-fire Socket.IO events are rate-limited without blocking normal usage
  2. Messages with Unicode control characters display safely (no visual spoofing)
  3. Channel notes API rejects requests from non-channel members
  4. Audit logs detect tampering when read
  5. Data export cannot export other organizations' data
  6. DMs page loads correctly on mobile
  7. Profile page layout has proper spacing
  8. Mobile navigation correctly highlights current route
**Plans**: 4 plans

Plans:
- [x] 31-01-PLAN.md — Socket.IO rate limiting with toast warnings
- [x] 31-02-PLAN.md — Unicode and HTML content sanitization
- [x] 31-03-PLAN.md — Data export authorization and audit log integrity
- [x] 31-04-PLAN.md — Mobile UI bug fixes (DM route, profile spacing, nav highlighting)

### Phase 32: Medium/Low Security
**Goal**: Complete security hardening with medium and low severity items
**Depends on**: Phase 31
**Requirements**: SEC2-09, SEC2-10, SEC2-11, SEC2-12, SEC2-13, SEC2-14, SEC2-15, SEC2-16, SEC2-17, SEC2-18, SEC2-19, SEC2-20, SEC2-21, SEC2-22
**Success Criteria** (what must be TRUE):
  1. Password registration rejects passwords found in breach databases
  2. User file uploads are tracked against configurable storage limits
  3. Session cookies use __Secure- prefix in production
  4. Production logs contain structured output without stack traces
  5. Socket.IO rejects connections from non-whitelisted origins
  6. MFA can be enabled with TOTP authenticator app
  7. Orphaned attachments are cleaned up within 24 hours
**Plans**: 7 plans

Plans:
- [x] 32-01-PLAN.md — Password breach check (bloom filter) and password history (SEC2-09, SEC2-20)
- [x] 32-02-PLAN.md — User storage quota tracking with 1GB default (SEC2-10)
- [x] 32-03-PLAN.md — Secure cookies, Pino logging, security headers (SEC2-11, SEC2-12, SEC2-18, SEC2-19)
- [x] 32-04-PLAN.md — Socket.IO CORS whitelist and guest disconnection (SEC2-13, SEC2-16)
- [x] 32-05-PLAN.md — Redirect validation and SSRF DNS rebinding protection (SEC2-14, SEC2-15)
- [x] 32-06-PLAN.md — TOTP MFA with backup codes (SEC2-21)
- [x] 32-07-PLAN.md — Orphaned attachment cleanup and SRI hashes (SEC2-22, SEC2-17)

### Phase 33: Workspace Management
**Goal**: Users can discover, join, and switch between workspaces
**Depends on**: Phase 32
**Requirements**: WKSP2-01, WKSP2-02, WKSP2-03, WKSP2-04, WKSP2-05, WKSP2-06
**Success Criteria** (what must be TRUE):
  1. User can view list of workspaces they belong to
  2. User can switch workspaces from header dropdown
  3. User can browse and request to join available workspaces
  4. Workspace owner can approve or reject join requests
  5. Workspace switcher displays unread message counts
**Plans**: 4 plans

Plans:
- [x] 33-01-PLAN.md — Join request schema and workspace unread aggregation
- [x] 33-02-PLAN.md — Workspace switcher UI with last-visited restoration
- [x] 33-03-PLAN.md — Browse workspaces page and join flow
- [x] 33-04-PLAN.md — Admin join request approval with notifications

### Phase 34: Sidebar Reorganization
**Goal**: Users can customize sidebar order with drag-and-drop, synced across devices
**Depends on**: Phase 33
**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, SIDE-06, SIDE-07, SIDE-08
**Success Criteria** (what must be TRUE):
  1. "New Category" button is in Settings, not sidebar
  2. Categories and channels can be reordered via drag-and-drop
  3. Channels can be moved between categories via drag-and-drop
  4. DM conversations can be reordered via drag-and-drop
  5. Sidebar sections (Notes, Scheduled, Reminders, Saved) can be reordered
  6. Sidebar order syncs across devices for same user
**Plans**: 5 plans

Plans:
- [x] 34-01-PLAN.md — Database schema and server actions for sidebar preferences
- [x] 34-02-PLAN.md — Category drag-and-drop reordering
- [x] 34-03-PLAN.md — DM conversation drag-and-drop reordering
- [x] 34-04-PLAN.md — Sidebar sections reordering and Settings page
- [x] 34-05-PLAN.md — Cross-device sync integration and verification

### Phase 35: Mobile Redesign
**Goal**: All features accessible on mobile with polished, touch-friendly UI
**Depends on**: Phase 34
**Requirements**: MOBI2-01, MOBI2-02, MOBI2-03, MOBI2-04, MOBI2-05, MOBI2-08, MOBI2-09, MOBI2-10, MOBI2-11, MOBI2-12
**Note**: MOBI2-06 and MOBI2-07 (User groups and guest management on mobile) are deferred - admin features remain desktop-only
**Success Criteria** (what must be TRUE):
  1. Scheduled messages, reminders, and bookmarks accessible from mobile navigation
  2. User status can be set/cleared from mobile
  3. Custom emoji picker works on mobile with touch-optimized layout
  4. Workspace analytics viewable on mobile with responsive charts
  5. All touch targets are minimum 44px
  6. Channel header actions in collapsible overflow menu
  7. Consistent spacing and layout across all mobile views
  8. Navigation state correctly reflects current route on all pages
**Plans**: 6 plans

Plans:
- [ ] 35-01-PLAN.md — Install vaul, Drawer component, useLongPress hook
- [ ] 35-02-PLAN.md — Analytics dashboard mobile responsive
- [ ] 35-03-PLAN.md — Mobile navigation with More menu (Scheduled, Reminders, Saved)
- [ ] 35-04-PLAN.md — Mobile status drawer and emoji picker
- [ ] 35-05-PLAN.md — Channel header mobile overflow menu enhancement
- [ ] 35-06-PLAN.md — Touch target audit and visual polish

### Phase 36: Stabilization
**Goal**: Verify all v0.6.0 functionality works together, fix integration issues
**Depends on**: Phase 35
**Requirements**: None (integration and polish)
**Success Criteria** (what must be TRUE):
  1. All security requirements pass verification
  2. All bug fixes verified in production-like environment
  3. Workspace management, sidebar, and mobile features work together
  4. No regression in existing v0.5.0 functionality
**Plans**: 5 plans

Plans:
- [ ] 36-01-PLAN.md — Test infrastructure setup (Docker Compose, Playwright config)
- [ ] 36-02-PLAN.md — Security requirement verification tests
- [ ] 36-03-PLAN.md — Workspace and sidebar E2E tests
- [ ] 36-04-PLAN.md — Mobile E2E and regression tests
- [ ] 36-05-PLAN.md — Release documentation and final verification

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 30. Critical Security | 3/3 | Complete | 2026-01-22 |
| 31. High Security + Bug Fixes | 4/4 | Complete | 2026-01-22 |
| 32. Medium/Low Security | 7/7 | Complete | 2026-01-23 |
| 33. Workspace Management | 4/4 | Complete | 2026-01-23 |
| 34. Sidebar Reorganization | 5/5 | Complete | 2026-01-23 |
| 35. Mobile Redesign | 0/6 | Planned | - |
| 36. Stabilization | 0/5 | Planned | - |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-01-23 after Phase 34 execution*

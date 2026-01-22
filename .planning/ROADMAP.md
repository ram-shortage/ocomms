# Roadmap: OComms v0.6.0

## Overview

v0.6.0 Polish & Hardening addresses security findings from audit, fixes known bugs, and delivers workspace management, sidebar reorganization, and mobile redesign. Security fixes are prioritized by severity (critical first), followed by feature work in logical delivery order.

## Milestones

- ✅ **v0.5.0 Feature Completeness** - Phases 24-29 (shipped 2026-01-21)
- 🚧 **v0.6.0 Polish & Hardening** - Phases 30-36 (in progress)

## Phases

<details>
<summary>✅ v0.5.0 Feature Completeness (Phases 24-29) - SHIPPED 2026-01-21</summary>

See: .planning/milestones/v0.5.0-ROADMAP.md

</details>

### 🚧 v0.6.0 Polish & Hardening (In Progress)

**Milestone Goal:** Harden security posture, fix known bugs, deliver workspace management, sidebar customization, and mobile improvements.

- [ ] **Phase 30: Critical Security** - CSP hardening, session validation, SVG sanitization
- [ ] **Phase 31: High Security + Bug Fixes** - Socket.IO rate limiting, content sanitization, authorization fixes, quick bug fixes
- [ ] **Phase 32: Medium/Low Security** - Password breach checks, quotas, logging, MFA, cleanup jobs
- [ ] **Phase 33: Workspace Management** - Workspace switcher, discovery, join flow
- [ ] **Phase 34: Sidebar Reorganization** - Drag-and-drop reordering, user preferences
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
- [ ] 30-01-PLAN.md — CSP nonce implementation with violation reporting
- [ ] 30-02-PLAN.md — Redis session validation with immediate revocation
- [ ] 30-03-PLAN.md — SVG upload blocking and asset migration

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
- [ ] 31-01-PLAN.md — Socket.IO rate limiting with toast warnings
- [ ] 31-02-PLAN.md — Unicode and HTML content sanitization
- [ ] 31-03-PLAN.md — Data export authorization and audit log integrity
- [ ] 31-04-PLAN.md — Mobile UI bug fixes (DM route, profile spacing, nav highlighting)

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
**Plans**: TBD

Plans:
- [ ] 32-01: TBD
- [ ] 32-02: TBD
- [ ] 32-03: TBD

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
**Plans**: TBD

Plans:
- [ ] 33-01: TBD
- [ ] 33-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 34-01: TBD
- [ ] 34-02: TBD

### Phase 35: Mobile Redesign
**Goal**: All features accessible on mobile with polished, touch-friendly UI
**Depends on**: Phase 34
**Requirements**: MOBI2-01, MOBI2-02, MOBI2-03, MOBI2-04, MOBI2-05, MOBI2-06, MOBI2-07, MOBI2-08, MOBI2-09, MOBI2-10, MOBI2-11, MOBI2-12
**Success Criteria** (what must be TRUE):
  1. Scheduled messages, reminders, and bookmarks accessible from mobile navigation
  2. User status can be set/cleared from mobile
  3. Custom emoji picker works on mobile with touch-optimized layout
  4. User groups and guest management accessible from mobile settings
  5. All touch targets are minimum 44px
  6. Channel header actions in collapsible overflow menu
  7. Consistent spacing and layout across all mobile views
**Plans**: TBD

Plans:
- [ ] 35-01: TBD
- [ ] 35-02: TBD

### Phase 36: Stabilization
**Goal**: Verify all v0.6.0 functionality works together, fix integration issues
**Depends on**: Phase 35
**Requirements**: None (integration and polish)
**Success Criteria** (what must be TRUE):
  1. All security requirements pass verification
  2. All bug fixes verified in production-like environment
  3. Workspace management, sidebar, and mobile features work together
  4. No regression in existing v0.5.0 functionality
**Plans**: TBD

Plans:
- [ ] 36-01: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 30. Critical Security | 0/3 | Ready | - |
| 31. High Security + Bug Fixes | 0/4 | Ready | - |
| 32. Medium/Low Security | 0/TBD | Not started | - |
| 33. Workspace Management | 0/TBD | Not started | - |
| 34. Sidebar Reorganization | 0/TBD | Not started | - |
| 35. Mobile Redesign | 0/TBD | Not started | - |
| 36. Stabilization | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-22*
*Last updated: 2026-01-22*

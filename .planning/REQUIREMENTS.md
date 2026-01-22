# Requirements: OComms v0.6.0

**Defined:** 2026-01-22
**Core Value:** Data sovereignty - complete control over communication data

## v1 Requirements

Requirements for v0.6.0 Polish & Hardening release.

### Security - Critical

- [x] **SEC2-01**: CSP policy removes `unsafe-inline` and `unsafe-eval`, uses nonce-based script loading
- [x] **SEC2-02**: Session validation cache moved server-side (Redis), invalidates on session revocation
- [x] **SEC2-03**: SVG uploads blocked at upload time with content detection (raster-only policy)

### Security - High

- [x] **SEC2-04**: Rate limiting applied to all Socket.IO handlers (reactions, typing, presence, threads)
- [x] **SEC2-05**: Message content sanitized for Unicode control chars, RTL override, zero-width chars
- [x] **SEC2-06**: Channel notes API verifies channel membership, not just workspace membership
- [x] **SEC2-07**: Audit logs signed with HMAC, integrity verified on read
- [x] **SEC2-08**: Data export derives organizationId from authenticated user, not request body

### Security - Medium

- [ ] **SEC2-09**: Password validation checks against Have I Been Pwned breach database
- [ ] **SEC2-10**: Per-user storage quota tracking with configurable limits
- [ ] **SEC2-11**: Production accepts only `__Secure-` prefixed session cookies
- [ ] **SEC2-12**: Structured logging with log levels, no stack traces in production
- [ ] **SEC2-13**: Socket.IO CORS validates origin against whitelist, logs violations
- [ ] **SEC2-14**: Redirect URLs validated against allowed domains on startup
- [ ] **SEC2-15**: Link preview SSRF protection includes DNS rebinding checks
- [ ] **SEC2-16**: Soft-locked guests disconnected from Socket.IO with notification

### Security - Low

- [ ] **SEC2-17**: Static assets use Subresource Integrity (SRI) hashes
- [ ] **SEC2-18**: API routes set security headers directly, not just via nginx
- [ ] **SEC2-19**: Development error messages sanitized, no implementation detail leaks
- [ ] **SEC2-20**: Password changes check against last 5 passwords
- [ ] **SEC2-21**: TOTP-based MFA with QR code setup and backup codes
- [ ] **SEC2-22**: Background job cleans up orphaned attachments older than 24h

### Bug Fixes

- [x] **FIX-01**: DMs route returns valid page on mobile (not 404)
- [x] **FIX-02**: Profile page title and back link properly spaced
- [x] **FIX-03**: Mobile channel header uses overflow menu for actions
- [x] **FIX-04**: Truncated workspace names show full name on hover
- [x] **FIX-05**: Mobile navigation highlights correct route after all navigations

### Workspace Management

- [ ] **WKSP2-01**: User can view list of workspaces they belong to
- [ ] **WKSP2-02**: User can switch between workspaces from header dropdown
- [ ] **WKSP2-03**: User can browse available workspaces to join
- [ ] **WKSP2-04**: User can request to join a workspace (owner approval)
- [ ] **WKSP2-05**: Owner can approve/reject join requests
- [ ] **WKSP2-06**: Workspace switcher shows unread counts per workspace

### Sidebar Reorganization

- [ ] **SIDE-01**: "New Category" button moved from sidebar to Settings page
- [ ] **SIDE-02**: Categories can be reordered via drag-and-drop
- [ ] **SIDE-03**: Channels can be reordered within categories via drag-and-drop
- [ ] **SIDE-04**: Channels can be moved between categories via drag-and-drop
- [ ] **SIDE-05**: DM conversations can be reordered via drag-and-drop
- [ ] **SIDE-06**: Sidebar sections (Notes, Scheduled, Reminders, Saved) can be reordered
- [ ] **SIDE-07**: Sidebar order preferences stored per-user in database
- [ ] **SIDE-08**: Sidebar order syncs across devices for same user

### Mobile Redesign - Feature Accessibility

- [ ] **MOBI2-01**: Scheduled messages accessible from mobile navigation
- [ ] **MOBI2-02**: Reminders accessible from mobile navigation
- [ ] **MOBI2-03**: Bookmarks/saved items accessible from mobile navigation
- [ ] **MOBI2-04**: User status can be set/cleared from mobile profile or header
- [ ] **MOBI2-05**: Custom emoji picker works on mobile with touch-optimized layout
- [ ] **MOBI2-06**: User groups manageable from mobile settings
- [ ] **MOBI2-07**: Guest management accessible from mobile settings
- [ ] **MOBI2-08**: Workspace analytics viewable on mobile with responsive charts

### Mobile Redesign - Visual Polish

- [ ] **MOBI2-09**: All touch targets minimum 44px
- [ ] **MOBI2-10**: Channel header actions in collapsible overflow menu
- [ ] **MOBI2-11**: Consistent spacing and layout across all mobile views
- [ ] **MOBI2-12**: Navigation state correctly reflects current route on all pages

## v2 Requirements

Deferred to future release.

### Enterprise Security

- **ENT-01**: SAML/SSO integration for enterprise identity providers
- **ENT-02**: Hardware security key support (WebAuthn/FIDO2)
- **ENT-03**: Session management UI (view/revoke active sessions)
- **ENT-04**: IP allowlist for workspace access

### Mobile Native

- **NAT-01**: iOS native app with push notifications
- **NAT-02**: Android native app with push notifications

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile apps | PWA provides mobile access; native deferred to v2 |
| SAML/SSO | Enterprise complexity, deferred to future milestone |
| WebAuthn/FIDO2 | TOTP sufficient for v0.6.0, hardware keys in future |
| Real-time collaborative sidebar editing | Per-user preferences sufficient |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC2-01 | Phase 30 | Complete |
| SEC2-02 | Phase 30 | Complete |
| SEC2-03 | Phase 30 | Complete |
| SEC2-04 | Phase 31 | Complete |
| SEC2-05 | Phase 31 | Complete |
| SEC2-06 | Phase 31 | Complete |
| SEC2-07 | Phase 31 | Complete |
| SEC2-08 | Phase 31 | Complete |
| SEC2-09 | Phase 32 | Pending |
| SEC2-10 | Phase 32 | Pending |
| SEC2-11 | Phase 32 | Pending |
| SEC2-12 | Phase 32 | Pending |
| SEC2-13 | Phase 32 | Pending |
| SEC2-14 | Phase 32 | Pending |
| SEC2-15 | Phase 32 | Pending |
| SEC2-16 | Phase 32 | Pending |
| SEC2-17 | Phase 32 | Pending |
| SEC2-18 | Phase 32 | Pending |
| SEC2-19 | Phase 32 | Pending |
| SEC2-20 | Phase 32 | Pending |
| SEC2-21 | Phase 32 | Pending |
| SEC2-22 | Phase 32 | Pending |
| FIX-01 | Phase 31 | Complete |
| FIX-02 | Phase 31 | Complete |
| FIX-03 | Phase 31 | Complete |
| FIX-04 | Phase 31 | Complete |
| FIX-05 | Phase 31 | Complete |
| WKSP2-01 | Phase 33 | Pending |
| WKSP2-02 | Phase 33 | Pending |
| WKSP2-03 | Phase 33 | Pending |
| WKSP2-04 | Phase 33 | Pending |
| WKSP2-05 | Phase 33 | Pending |
| WKSP2-06 | Phase 33 | Pending |
| SIDE-01 | Phase 34 | Pending |
| SIDE-02 | Phase 34 | Pending |
| SIDE-03 | Phase 34 | Pending |
| SIDE-04 | Phase 34 | Pending |
| SIDE-05 | Phase 34 | Pending |
| SIDE-06 | Phase 34 | Pending |
| SIDE-07 | Phase 34 | Pending |
| SIDE-08 | Phase 34 | Pending |
| MOBI2-01 | Phase 35 | Pending |
| MOBI2-02 | Phase 35 | Pending |
| MOBI2-03 | Phase 35 | Pending |
| MOBI2-04 | Phase 35 | Pending |
| MOBI2-05 | Phase 35 | Pending |
| MOBI2-06 | Phase 35 | Pending |
| MOBI2-07 | Phase 35 | Pending |
| MOBI2-08 | Phase 35 | Pending |
| MOBI2-09 | Phase 35 | Pending |
| MOBI2-10 | Phase 35 | Pending |
| MOBI2-11 | Phase 35 | Pending |
| MOBI2-12 | Phase 35 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0

---
*Requirements defined: 2026-01-22*
*Last updated: 2026-01-22 after Phase 31 completion*

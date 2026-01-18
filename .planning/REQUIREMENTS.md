# Requirements: OComms

**Defined:** 2026-01-18
**Core Value:** Data sovereignty - complete control over communication data

## v0.3.0 Requirements

Requirements for Mobile & Polish milestone. Each maps to roadmap phases.

### PWA Foundation

- [ ] **PWA-01**: App has web app manifest with icons, theme colors, display mode
- [ ] **PWA-02**: Service worker caches app shell for instant load
- [ ] **PWA-03**: Custom offline page displays when network unavailable
- [ ] **PWA-04**: Custom install prompt triggers after user engagement
- [ ] **PWA-05**: Service worker update notification allows user-controlled reload
- [ ] **PWA-06**: iOS users see "Add to Home Screen" guidance

### Offline Support

- [ ] **OFFL-01**: Messages cached in IndexedDB with 7-day retention
- [ ] **OFFL-02**: User can read cached messages when offline
- [ ] **OFFL-03**: User can compose messages offline (queued locally)
- [ ] **OFFL-04**: Pending messages show status indicator (pending/sent/failed)
- [ ] **OFFL-05**: Queued messages sync automatically on reconnect
- [ ] **OFFL-06**: Messages display instantly with optimistic UI updates
- [ ] **OFFL-07**: Failed sends retry with exponential backoff + jitter

### Push Notifications

- [ ] **PUSH-01**: Server generates VAPID keys for Web Push
- [ ] **PUSH-02**: User can subscribe to push notifications
- [ ] **PUSH-03**: User receives push for direct messages
- [ ] **PUSH-04**: User receives push for @mentions
- [ ] **PUSH-05**: Clicking notification opens specific conversation
- [ ] **PUSH-06**: User can configure notification preferences per channel

### Mobile UI

- [ ] **MOBI-01**: Bottom tab bar navigation (Home, DMs, Mentions, Search, Profile)
- [ ] **MOBI-02**: Responsive layout adapts to mobile screen sizes
- [ ] **MOBI-03**: Touch targets meet 44px minimum size
- [ ] **MOBI-04**: Pull-to-refresh reloads content
- [ ] **MOBI-05**: Virtual keyboard doesn't break layout

### UI Polish

- [ ] **UIPOL-01**: Sidebar includes navigation links for /threads and /search
- [ ] **UIPOL-02**: Logout button visible in layout
- [ ] **UIPOL-03**: Audit log viewer with table, filtering, and export
- [ ] **UIPOL-04**: Data export UI for JSON/CSV download
- [ ] **UIPOL-05**: USER-SETUP.md documentation complete
- [ ] **UIPOL-06**: HSTS max-age set to production value (31536000)

### Security Fixes

- [x] **SECFIX-01**: @mention resolution scoped to organization membership
- [x] **SECFIX-02**: Middleware fails closed on validation errors
- [x] **SECFIX-03**: Message sequences use atomic increment (no race condition)
- [x] **SECFIX-04**: getChannel verifies organization membership
- [x] **SECFIX-05**: Server enforces maximum message length
- [x] **SECFIX-06**: Server enforces message rate limits per user
- [x] **SECFIX-07**: Workspace URL uses NEXT_PUBLIC_APP_URL, not hard-coded domain
- [x] **SECFIX-08**: Audit logger uses async file writes

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Mobile Gestures

- **GEST-01**: Swipe-to-reply on messages
- **GEST-02**: Long-press context menus
- **GEST-03**: Haptic feedback on actions
- **GEST-04**: Swipe between tabs

### Advanced Notifications

- **NOTF-01**: Quiet hours (suppress during set times)
- **NOTF-02**: Notification grouping (collapse multiple messages)
- **NOTF-03**: Thread reply notifications

### Advanced Offline

- **AOFFL-01**: Offline search through cached messages
- **AOFFL-02**: Sync conflict resolution for edits

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full offline mode (all data) | iOS 50MB storage limit, 7-day eviction |
| Background sync on iOS | Not supported by Safari |
| Native share target | Limited support, not critical for chat |
| Badge API on iOS | Not supported |
| Offline file upload | Files too large to cache reliably |
| Complex offline editing | Conflict resolution too complex for v0.3.0 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PWA-01 | Phase 15 | Pending |
| PWA-02 | Phase 15 | Pending |
| PWA-03 | Phase 15 | Pending |
| PWA-04 | Phase 15 | Pending |
| PWA-05 | Phase 15 | Pending |
| PWA-06 | Phase 15 | Pending |
| OFFL-01 | Phase 16 | Pending |
| OFFL-02 | Phase 16 | Pending |
| OFFL-03 | Phase 17 | Pending |
| OFFL-04 | Phase 17 | Pending |
| OFFL-05 | Phase 17 | Pending |
| OFFL-06 | Phase 17 | Pending |
| OFFL-07 | Phase 17 | Pending |
| PUSH-01 | Phase 18 | Pending |
| PUSH-02 | Phase 18 | Pending |
| PUSH-03 | Phase 18 | Pending |
| PUSH-04 | Phase 18 | Pending |
| PUSH-05 | Phase 18 | Pending |
| PUSH-06 | Phase 18 | Pending |
| MOBI-01 | Phase 19 | Pending |
| MOBI-02 | Phase 19 | Pending |
| MOBI-03 | Phase 19 | Pending |
| MOBI-04 | Phase 19 | Pending |
| MOBI-05 | Phase 19 | Pending |
| UIPOL-01 | Phase 20 | Pending |
| UIPOL-02 | Phase 20 | Pending |
| UIPOL-03 | Phase 20 | Pending |
| UIPOL-04 | Phase 20 | Pending |
| UIPOL-05 | Phase 20 | Pending |
| UIPOL-06 | Phase 20 | Pending |
| SECFIX-01 | Phase 14 | Complete |
| SECFIX-02 | Phase 14 | Complete |
| SECFIX-03 | Phase 14 | Complete |
| SECFIX-04 | Phase 14 | Complete |
| SECFIX-05 | Phase 14 | Complete |
| SECFIX-06 | Phase 14 | Complete |
| SECFIX-07 | Phase 14 | Complete |
| SECFIX-08 | Phase 14 | Complete |

**Coverage:**
- v0.3.0 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-18 after Phase 14 completion*

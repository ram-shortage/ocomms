# Requirements: OComms

**Defined:** 2026-01-18
**Core Value:** Data sovereignty — complete control over communication data

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

- [ ] **SECFIX-01**: @mention resolution scoped to organization membership
- [ ] **SECFIX-02**: Middleware fails closed on validation errors
- [ ] **SECFIX-03**: Message sequences use atomic increment (no race condition)
- [ ] **SECFIX-04**: getChannel verifies organization membership
- [ ] **SECFIX-05**: Server enforces maximum message length
- [ ] **SECFIX-06**: Server enforces message rate limits per user
- [ ] **SECFIX-07**: Workspace URL uses NEXT_PUBLIC_APP_URL, not hard-coded domain
- [ ] **SECFIX-08**: Audit logger uses async file writes

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
| PWA-01 | TBD | Pending |
| PWA-02 | TBD | Pending |
| PWA-03 | TBD | Pending |
| PWA-04 | TBD | Pending |
| PWA-05 | TBD | Pending |
| PWA-06 | TBD | Pending |
| OFFL-01 | TBD | Pending |
| OFFL-02 | TBD | Pending |
| OFFL-03 | TBD | Pending |
| OFFL-04 | TBD | Pending |
| OFFL-05 | TBD | Pending |
| OFFL-06 | TBD | Pending |
| OFFL-07 | TBD | Pending |
| PUSH-01 | TBD | Pending |
| PUSH-02 | TBD | Pending |
| PUSH-03 | TBD | Pending |
| PUSH-04 | TBD | Pending |
| PUSH-05 | TBD | Pending |
| PUSH-06 | TBD | Pending |
| MOBI-01 | TBD | Pending |
| MOBI-02 | TBD | Pending |
| MOBI-03 | TBD | Pending |
| MOBI-04 | TBD | Pending |
| MOBI-05 | TBD | Pending |
| UIPOL-01 | TBD | Pending |
| UIPOL-02 | TBD | Pending |
| UIPOL-03 | TBD | Pending |
| UIPOL-04 | TBD | Pending |
| UIPOL-05 | TBD | Pending |
| UIPOL-06 | TBD | Pending |
| SECFIX-01 | TBD | Pending |
| SECFIX-02 | TBD | Pending |
| SECFIX-03 | TBD | Pending |
| SECFIX-04 | TBD | Pending |
| SECFIX-05 | TBD | Pending |
| SECFIX-06 | TBD | Pending |
| SECFIX-07 | TBD | Pending |
| SECFIX-08 | TBD | Pending |

**Coverage:**
- v0.3.0 requirements: 33 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 33

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-18 after initial definition*

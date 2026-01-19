# Roadmap: OComms

## Milestones

- [x] **v0.1.0 Full Conversation** - Phases 1-8 (shipped 2026-01-18)
- [x] **v0.2.0 Security Hardening** - Phases 9-13 (shipped 2026-01-18)
- [ ] **v0.3.0 Mobile & Polish** - Phases 14-20 (in progress)

## Phases

<details>
<summary>v0.1.0 Full Conversation (Phases 1-8) - SHIPPED 2026-01-18</summary>

See: .planning/milestones/v0.1.0-ROADMAP.md

</details>

<details>
<summary>v0.2.0 Security Hardening (Phases 9-13) - SHIPPED 2026-01-18</summary>

See: .planning/milestones/v0.2.0-ROADMAP.md

</details>

### v0.3.0 Mobile & Polish (In Progress)

**Milestone Goal:** Complete UI gaps, add PWA support with offline capability and push notifications for mobile access.

- [x] **Phase 14: Security Fixes** - Harden existing code before adding features
- [x] **Phase 15: PWA Foundation** - Installable PWA with app shell caching
- [x] **Phase 16: Message Caching** - IndexedDB schema and offline reading
- [ ] **Phase 17: Offline Send Queue** - Compose offline with auto-sync
- [ ] **Phase 18: Push Notifications** - Web Push for DMs and mentions
- [ ] **Phase 19: Mobile Layout** - Bottom tabs and responsive design
- [ ] **Phase 20: UI Polish** - Admin UIs, sidebar nav, documentation

## Phase Details

### Phase 14: Security Fixes
**Goal**: Harden existing code with scoping fixes, input limits, and async improvements
**Depends on**: Nothing (runs first to stabilize before new features)
**Requirements**: SECFIX-01, SECFIX-02, SECFIX-03, SECFIX-04, SECFIX-05, SECFIX-06, SECFIX-07, SECFIX-08
**Success Criteria** (what must be TRUE):
  1. @mention autocomplete only shows users in the same organization
  2. Middleware returns 401/403 on validation errors (never passes invalid requests)
  3. Messages have sequential order numbers without race conditions
  4. getChannel rejects requests for channels outside user's organization
  5. Server rejects messages exceeding size limit; rate-limited users receive clear feedback
**Plans**: 3 plans
Plans:
- [x] 14-01-PLAN.md — Server-side security (fail-closed middleware, getChannel org check, async audit)
- [x] 14-02-PLAN.md — Message handler fixes (atomic sequence, length limit, rate limiting)
- [x] 14-03-PLAN.md — Client UX and scoping (@mention org scope, character counter, rate limit UI)

### Phase 15: PWA Foundation
**Goal**: Users can install the app to their home screen with fast initial load
**Depends on**: Phase 14
**Requirements**: PWA-01, PWA-02, PWA-03, PWA-04, PWA-05, PWA-06
**Success Criteria** (what must be TRUE):
  1. Browser shows install prompt after user engagement; clicking installs to home screen
  2. App loads instantly from cache on repeat visits
  3. Custom offline page displays when network unavailable (not browser error)
  4. Update notification appears when new version available; user can refresh to update
  5. iOS users see "Add to Home Screen" instructions (Safari doesn't have native install)
**Plans**: 3 plans
Plans:
- [x] 15-01-PLAN.md — PWA infrastructure (manifest, Serwist config, icons)
- [x] 15-02-PLAN.md — Service worker and offline page
- [x] 15-03-PLAN.md — PWA components (install prompt, iOS guide, update notification, offline banner)

### Phase 16: Message Caching
**Goal**: Users can read recent messages when offline
**Depends on**: Phase 15 (requires service worker)
**Requirements**: OFFL-01, OFFL-02
**Success Criteria** (what must be TRUE):
  1. Messages populate IndexedDB when user views a channel
  2. User can scroll through cached messages with no network connection
  3. Messages older than 7 days are automatically cleaned up
**Plans**: 2 plans
Plans:
- [x] 16-01-PLAN.md — IndexedDB foundation (Dexie schema, cache operations, initialization)
- [x] 16-02-PLAN.md — Cache integration (React hooks, MessageList wiring, offline fallback)

### Phase 17: Offline Send Queue
**Goal**: Users can compose and send messages while offline
**Depends on**: Phase 16 (requires IndexedDB schema)
**Requirements**: OFFL-03, OFFL-04, OFFL-05, OFFL-06, OFFL-07
**Success Criteria** (what must be TRUE):
  1. User can type and submit a message with no network; message appears immediately
  2. Pending messages show distinct indicator (pending/sent/failed status visible)
  3. When network returns, queued messages send automatically
  4. Failed messages retry with backoff; user can see retry attempts
  5. Optimistic UI shows message instantly before server confirmation
**Plans**: 4 plans
Plans:
- [ ] 17-01-PLAN.md — Queue infrastructure (Dexie sendQueue table, queue operations, backoff utility)
- [ ] 17-02-PLAN.md — Queue processing and sync (socket integration, reconnect listeners)
- [ ] 17-03-PLAN.md — Optimistic UI hooks (useSendMessage, useSendQueue, MessageInput update)
- [ ] 17-04-PLAN.md — Status indicators and polish (MessageStatus, retry UI, thread integration)

### Phase 18: Push Notifications
**Goal**: Users receive push notifications for DMs and mentions
**Depends on**: Phase 15 (requires service worker)
**Requirements**: PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05, PUSH-06
**Success Criteria** (what must be TRUE):
  1. Server generates VAPID keys on first start (stored in environment)
  2. User can enable push notifications (double-permission pattern)
  3. User receives push when someone sends a DM
  4. User receives push when mentioned in a channel
  5. Clicking notification opens the specific conversation
  6. User can configure per-channel notification preferences (all/mentions/none)
**Plans**: 5 plans
Plans:
- [ ] 18-01-PLAN.md — Push infrastructure (VAPID config, push subscription schema, SW push handlers)
- [ ] 18-02-PLAN.md — Subscription API (VAPID public key endpoint, subscribe/unsubscribe routes)
- [ ] 18-03-PLAN.md — Push delivery (sendPushToUser utility, mention and DM push triggers)
- [ ] 18-04-PLAN.md — Push UI (usePushSubscription hook, permission prompt, settings panel)
- [ ] 18-05-PLAN.md — Integration and verification (PWAProvider integration, settings page, e2e testing)

### Phase 19: Mobile Layout
**Goal**: App provides native-like mobile experience
**Depends on**: Phase 15 (PWA installed for full experience)
**Requirements**: MOBI-01, MOBI-02, MOBI-03, MOBI-04, MOBI-05
**Success Criteria** (what must be TRUE):
  1. Bottom tab bar visible on mobile (Home, DMs, Mentions, Search, Profile)
  2. Layout adapts correctly to phone screen sizes
  3. All interactive elements meet 44px minimum touch target
  4. Pull-to-refresh reloads current view
  5. Virtual keyboard doesn't break input positioning
**Plans**: TBD

### Phase 20: UI Polish
**Goal**: Complete remaining UI gaps and documentation
**Depends on**: Phase 19
**Requirements**: UIPOL-01, UIPOL-02, UIPOL-03, UIPOL-04, UIPOL-05, UIPOL-06
**Success Criteria** (what must be TRUE):
  1. Sidebar shows navigation links to /threads and /search pages
  2. Logout button visible and functional in layout
  3. Admin can view audit logs with filtering and export
  4. Admin can export organization data as JSON/CSV
  5. USER-SETUP.md provides complete setup instructions
  6. HSTS max-age set to 31536000 (1 year) for production
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 14. Security Fixes | v0.3.0 | 3/3 | Complete | 2026-01-18 |
| 15. PWA Foundation | v0.3.0 | 3/3 | Complete | 2026-01-18 |
| 16. Message Caching | v0.3.0 | 2/2 | Complete | 2026-01-19 |
| 17. Offline Send Queue | v0.3.0 | 0/4 | Planned | - |
| 18. Push Notifications | v0.3.0 | 0/5 | Planned | - |
| 19. Mobile Layout | v0.3.0 | 0/TBD | Not started | - |
| 20. UI Polish | v0.3.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-18*
*Last updated: 2026-01-19 after Phase 18 planning*

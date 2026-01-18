# Project Research Summary

**Project:** OComms v0.3.0 - Mobile & Polish
**Domain:** PWA enhancement for self-hosted team chat
**Researched:** 2026-01-18
**Confidence:** HIGH

## Executive Summary

PWA technology has matured significantly with iOS 16.4+ push notification support, making a well-built PWA capable of delivering near-native chat experience on both Android and iOS. For OComms, the recommended approach is: **service worker handles caching/push/background-sync, while Socket.IO remains the real-time source of truth**. IndexedDB (via Dexie.js) serves as the offline cache and message queue, not a full replica. The key architectural insight is that these systems operate in parallel with clear boundaries - the service worker never replaces Socket.IO for real-time messaging.

The recommended stack is minimal and well-proven: Serwist for service worker management (official Next.js recommendation), Dexie.js for IndexedDB with reactive React hooks, and web-push for VAPID-based notifications that respect OComms' data sovereignty. No third-party push services needed. The manifest and service worker registration integrate cleanly with Next.js 15 App Router.

Critical risks center on iOS limitations and offline sync complexity. iOS Safari's 7-day storage eviction policy means users who don't install to home screen will lose cached data - installation prompts must be prominent. The offline message queue requires careful implementation: persist to IndexedDB immediately, use client-generated UUIDs for idempotency, show clear pending/sent/failed status, and don't rely on Background Sync alone (it doesn't work on iOS). Push notification permission is permanent once denied, so use double-permission pattern with custom UI before triggering browser prompt.

## Key Findings

### Recommended Stack

The stack prioritizes libraries that are actively maintained, officially recommended, and respect OComms' self-hosted nature.

**Core technologies:**
- **Serwist** (^9.5.0): Service worker management - official Next.js PWA docs recommendation, App Router native, Workbox foundation
- **Dexie.js** (^4.2.1) + dexie-react-hooks: IndexedDB with `useLiveQuery()` for reactive cache - superior DX over raw idb, handles migrations
- **web-push** (^3.6.7): VAPID push notifications - no Google/third-party servers, data sovereignty maintained
- **Built-in**: Next.js `app/manifest.ts` for web manifest, Serwist includes Background Sync

**What NOT to use:**
- next-pwa (abandoned 2+ years)
- Firebase Cloud Messaging (data through Google servers - contradicts data sovereignty)
- OneSignal/Pusher Beams (third-party push services)
- localForage/idb (insufficient for complex message queries)

### Expected Features

**Must have (table stakes):**
- Install to home screen with custom install prompt
- Custom offline page (branded, not browser error)
- Read cached messages offline (7-day retention)
- Compose and queue messages offline with clear pending indicators
- Automatic sync on reconnect
- Push notifications for DMs and @mentions
- Bottom tab navigation (mobile standard since Slack 2020 redesign)
- Responsive mobile layout with 44px touch targets

**Should have (differentiators):**
- Notification preferences per-channel (all/mentions/none)
- Swipe-to-reply gesture on messages
- Update notification when new version available
- iOS install guidance ("Add to Home Screen" instructions)
- Quiet hours for push delivery

**Defer (v2+):**
- Swipe between tabs
- Offline search (complex, limited value)
- Notification grouping
- Background Fetch API (limited support)

### Architecture Approach

The PWA integrates with OComms' existing Next.js 15 + Socket.IO architecture through clear boundaries: service worker handles caching/push/background-sync in parallel to the main app. Socket.IO remains the source of truth for online messaging; IndexedDB is the offline cache and queue. Background sync uses HTTP POST to a new `/api/messages` endpoint (service workers can't use WebSockets), with the server broadcasting via Socket.IO after persistence.

**Major components:**
1. **Service Worker** (`public/sw.js`) - Cache shell assets, handle push events, process background sync queue
2. **IndexedDB** (via Dexie.js) - Store cached messages, offline queue, sync cursors, push subscription
3. **Push Subscription Manager** - VAPID key handling, server-side web-push integration, subscription storage
4. **Mobile Layout** - Bottom tab bar, responsive breakpoints, safe area handling

**Data flow for offline sends:**
1. User sends message while offline
2. Save to IndexedDB with status: `pending`
3. Display with pending indicator
4. Register Background Sync (or retry on foreground for iOS)
5. POST to `/api/messages` when online
6. Update status to `sent`, server broadcasts via Socket.IO

### Critical Pitfalls

1. **Auto skipWaiting() without user consent** - New service worker takes over mid-action, loses typed message. Prevention: Show "Update available" notification, let user choose when to refresh.

2. **iOS Safari 7-day storage eviction** - All IndexedDB data deleted after 7 days of no visits (unless installed to home screen). Prevention: Prompt home screen installation early and clearly; installed PWAs are exempt.

3. **Offline message queue lost on close** - User sends offline, closes app, message never sent. Prevention: Write to IndexedDB immediately (not just memory), retry queue on every app open, not just Background Sync.

4. **Push permission denied = permanent block** - One "Deny" click means no notifications ever. Prevention: Double-permission pattern - show custom UI explaining value first, only trigger browser prompt after user clicks "Enable."

5. **No idempotency keys = duplicate messages** - Network timeout triggers retry, same message sent multiple times. Prevention: Generate UUID client-side when user creates message, server rejects duplicates.

## Implications for Roadmap

Based on technical dependencies and risk mitigation, suggested phase structure:

### Phase 1: PWA Foundation
**Rationale:** Zero dependencies, enables all other PWA features. Must establish service worker and manifest before caching/push/offline.
**Delivers:** Installable PWA with app shell caching, custom offline page, install prompt UI
**Features:** Install to home screen, custom offline page, fast initial load
**Avoids:** SW2 (cached sw.js), SW3 (over-caching), iOS3 (no install prompt)
**Complexity:** Low

### Phase 2: IndexedDB & Message Caching
**Rationale:** Foundation for all offline features. Must have schema before storing messages.
**Delivers:** Dexie.js schema, React hooks (`useLiveQuery`), cache population on channel load, read from cache when offline
**Features:** Read cached messages offline, 7-day retention with cleanup
**Uses:** Dexie.js, dexie-react-hooks
**Avoids:** C2 (iOS 7-day eviction - via cleanup strategy), IDB1-4 (quota/cleanup/timeout/migration pitfalls)
**Complexity:** Medium

### Phase 3: Offline Send Queue
**Rationale:** Depends on IndexedDB schema (Phase 2). Most complex phase - requires new API endpoint, background sync, iOS fallback.
**Delivers:** Offline message queue, POST `/api/messages` endpoint, Background Sync registration, status indicators (pending/sent/failed)
**Features:** Compose messages offline, automatic sync on reconnect, retry with backoff
**Uses:** Serwist Background Sync, Dexie.js
**Avoids:** C3 (queue loss), OS1-5 (idempotency, rollback, ordering, sync storms, silent failures), PN3 (iOS no background sync)
**Complexity:** High - most critical phase for correctness

### Phase 4: Push Notifications
**Rationale:** Depends on service worker (Phase 1). High impact but isolated from offline features.
**Delivers:** VAPID key setup, push subscription management, server-side web-push integration, notification click handling
**Features:** Push for DMs and @mentions, notification preferences, iOS-specific install gate
**Uses:** web-push library
**Avoids:** C4 (permission denied permanent), PN1-4 (sensitive payload, iOS install required, VAPID key management)
**Complexity:** High - server changes + VAPID + Safari quirks

### Phase 5: Mobile Layout
**Rationale:** Independent of PWA features - can start in parallel with Phase 3-4 if desired.
**Delivers:** Bottom tab bar, responsive views, touch-optimized targets
**Features:** Bottom tab navigation, responsive layout, pull-to-refresh
**Avoids:** iOS2 (100vh bug), iOS6 (safe area insets)
**Complexity:** Medium - standard responsive patterns

### Phase 6: UI Polish
**Rationale:** After core PWA and mobile work complete, polish items for v0.3.0 completion.
**Delivers:** Swipe gestures, update notifications, notification preferences UI, quiet hours
**Features:** Swipe-to-reply, update notification, per-channel notification settings
**Complexity:** Medium

### Phase Ordering Rationale

- **Phase 1 first:** Service worker and manifest are prerequisites for all PWA features
- **Phase 2 before 3:** IndexedDB schema must exist before message queue can store pending messages
- **Phase 3 is critical path:** Most complex, highest risk of data loss bugs - deserves focused attention
- **Phase 4 after 3:** Push doesn't depend on offline queue, but both need service worker; grouping avoids context switching
- **Phase 5 parallel-capable:** No technical dependency on Phases 2-4, could run in parallel if resources allow
- **Phase 6 last:** Polish after core functionality solid

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Offline Send Queue):** Background Sync browser support varies, iOS fallback critical, idempotency implementation needs careful design
- **Phase 4 (Push Notifications):** Safari/iOS push subscription quirks, VAPID key rotation, subscription expiry handling

Phases with standard patterns (skip research-phase):
- **Phase 1 (PWA Foundation):** Well-documented, Serwist has official Next.js guide
- **Phase 2 (IndexedDB):** Dexie.js has excellent documentation and examples
- **Phase 5 (Mobile Layout):** Standard responsive patterns, Slack/Discord patterns documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations from official docs (Next.js PWA guide, Serwist, Dexie, web-push npm) |
| Features | HIGH | Verified against MDN, web.dev, Slack/Discord mobile implementations |
| Architecture | HIGH | Official MDN docs, Socket.IO docs, 2025-2026 PWA guides |
| Pitfalls | HIGH | MDN, WebKit official sources, community patterns (Rich Harris service worker guide) |

**Overall confidence:** HIGH

### Gaps to Address

- **Background Sync fallback timing:** Exact retry timing on iOS app foreground needs testing - start with "retry on visibility change"
- **Push subscription expiry:** web-push doesn't notify on expiry - need periodic revalidation strategy during implementation
- **Storage budget validation:** 35MB target is estimate - monitor `navigator.storage.estimate()` during testing
- **Service worker update race condition:** StaleWhileRevalidate + skipWaiting edge case needs testing with slow networks

## Sources

### Primary (HIGH confidence)
- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps) - official Serwist recommendation
- [Serwist Documentation](https://serwist.pages.dev/docs/next/getting-started) - service worker setup
- [MDN: PWA Best Practices](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices) - features
- [MDN: Offline and Background Operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) - offline patterns
- [MDN: Push API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_Practices) - push patterns
- [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) - iOS limitations
- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) - iOS 7-day eviction
- [Dexie.js](https://dexie.org/) - IndexedDB wrapper
- [web-push npm](https://www.npmjs.com/package/web-push) - push notifications

### Secondary (MEDIUM confidence)
- [Slack Design: Re-designing Slack Mobile](https://slack.design/articles/re-designing-slack-on-mobile/) - mobile UI patterns
- [Discord: Android Navigation Redesign](https://discord.com/blog/how-discord-made-android-in-app-navigation-easier) - bottom tabs
- [Ably: Chat Architecture](https://ably.com/blog/chat-architecture-reliable-message-ordering) - offline queue patterns
- [Rich Harris: Service Worker Tips](https://gist.github.com/Rich-Harris/fd6c3c73e6e707e312d7c5d7d0f3b2f9) - pitfalls
- [Brainhub: PWA on iOS 2025](https://brainhub.eu/library/pwa-on-ios) - iOS limitations

### Tertiary (LOW confidence)
- Community blog posts on PWA update patterns - validated against official sources

---
*Research completed: 2026-01-18*
*Ready for roadmap: yes*

# Pitfalls Research: PWA & Mobile

**Project:** OComms - Self-hosted Team Chat
**Researched:** 2026-01-18
**Confidence:** HIGH (verified with MDN, WebKit, web.dev official sources)

## Executive Summary

PWA development for chat applications has a minefield of pitfalls, particularly around service worker updates, offline sync, and iOS limitations. The self-hosted constraint adds complexity since we cannot rely on third-party services to handle edge cases.

**Most critical risks:**
1. Service worker update hell - users stuck on old versions
2. iOS Safari 7-day storage eviction - data loss if not installed to home screen
3. Offline message loss - duplicate or lost messages during sync
4. Push notification permission fatigue - one "deny" means permanent block

---

## Critical Pitfalls

These mistakes break the user experience or cause data loss.

### Pitfall C1: Automatic skipWaiting() Without User Consent

**What goes wrong:** New service worker immediately takes over, refreshing the page mid-action. User loses typed message, expanded menu state resets, or form data disappears.

**Why it happens:** Developers add `self.skipWaiting()` in the install event to avoid "update stuck in waiting" issues, without considering user context.

**Consequences:**
- Lost in-progress messages
- Disorienting page reloads
- Users perceive app as unstable/buggy

**Warning signs:**
- Page refreshes unexpectedly during typing
- Users report "lost messages"
- State resets randomly

**Prevention:**
1. Never auto-skipWaiting for apps with user state
2. Show "Update available" notification
3. Let user choose when to refresh
4. Persist draft messages to IndexedDB before refresh

**Phase to address:** Service Worker Setup phase - bake this in from day one

**Source:** [PWA Update Patterns](https://dev.to/thepassle/on-pwa-update-patterns-4fgm)

---

### Pitfall C2: iOS Safari 7-Day Storage Eviction

**What goes wrong:** Safari deletes all IndexedDB data, service worker registration, and cached files after 7 days of no site visits.

**Why it happens:** Safari's Intelligent Tracking Prevention (ITP) treats script-writable storage as potential tracking vector. Applies to Safari 13.1+ on iOS/iPadOS 13.4+ and macOS.

**Consequences:**
- User opens app after vacation: all cached messages gone
- Service worker deleted: app falls back to network-only
- Perceived data loss even though server has messages

**Warning signs:**
- Users returning after break report empty message history
- Service worker re-registering on users who previously had it
- Cache misses spike on Mondays

**Prevention:**
1. **Add to Home Screen:** Installed PWAs are exempt from 7-day policy
2. Prompt installation early and clearly
3. Design for graceful cache miss - fetch from server
4. Use `navigator.storage.persist()` for critical data
5. Inform users: "Install OComms to enable offline access"

**Phase to address:** PWA Installation & manifest phase

**Source:** [web.dev Storage for the Web](https://web.dev/articles/storage-for-the-web), [WebKit Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)

---

### Pitfall C3: Offline Message Queue Lost on Crash/Close

**What goes wrong:** User sends message offline, closes app before sync happens, message never sent and never retried.

**Why it happens:** Queue stored only in memory, or Background Sync not triggering reliably (especially iOS).

**Consequences:**
- User thinks message sent, recipient never receives it
- Critical team communication lost
- Trust in app destroyed

**Warning signs:**
- Users report "sent message but they never got it"
- Messages missing from server that user insists they sent
- Support tickets spike after network outages

**Prevention:**
1. Write to IndexedDB immediately when user taps send
2. Mark with status: `pending`, `syncing`, `synced`, `failed`
3. Show clear UI indicator (spinner, checkmark, error icon)
4. Retry queue on every app open, not just Background Sync
5. Keep retry queue across app restarts
6. On iOS: Don't rely on Background Sync - manual retry on foreground

**Phase to address:** Offline Queue phase - critical infrastructure

**Source:** [Ably Chat Architecture](https://ably.com/blog/chat-architecture-reliable-message-ordering)

---

### Pitfall C4: Push Permission Denied = Permanent Block

**What goes wrong:** User clicks "Deny" on browser permission prompt, cannot receive notifications ever (until they manually change browser settings).

**Why it happens:** Permission prompt shown too early (on page load) before user understands value.

**Consequences:**
- User can never receive push notifications
- Changing requires deep browser settings navigation
- Most users won't figure it out

**Warning signs:**
- Low push subscription rates (< 20%)
- Users complain "I never get notified"
- Support asks users to clear browser data

**Prevention:**
1. **Never** request permission on page load
2. Use double-permission pattern: show custom UI first explaining value
3. Only trigger browser prompt after user clicks "Enable notifications"
4. Wait for moment of value: first mention in a channel, first DM received
5. Explain what notifications they'll receive

**Phase to address:** Push Notification phase

**Source:** [web.dev Push Permissions UX](https://web.dev/articles/push-notifications-permissions-ux), [MDN Push Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_Practices)

---

## Service Worker Pitfalls

### Pitfall SW1: Cache-First for API Data

**What goes wrong:** API responses cached indefinitely, users see stale messages/channels even when online.

**Why it happens:** Applying same caching strategy to static assets and dynamic API data.

**Consequences:**
- Messages don't update
- Channel membership shows wrong users
- Users see content from hours/days ago

**Prevention:**
- Use Network-First for user data (messages, channels, presence)
- Use Stale-While-Revalidate for semi-dynamic content (user profiles)
- Use Cache-First only for truly static assets (app shell, icons)

**Phase to address:** Service Worker Caching phase

---

### Pitfall SW2: Caching service-worker.js

**What goes wrong:** Browser caches the service worker file itself, never checks for updates.

**Why it happens:** Generic cache headers applied to all JS files including sw.js.

**Consequences:**
- Users stuck on old service worker for 24+ hours
- Bug fixes don't deploy
- New features invisible to users

**Prevention:**
1. Set `Cache-Control: max-age=0, no-cache` for service-worker.js
2. Use versioning constant in SW file
3. Implement update check on each page load
4. Never serve sw.js through CDN cache

**Phase to address:** Service Worker Setup phase

**Source:** [Rich Harris SW Tips](https://gist.github.com/Rich-Harris/fd6c3c73e6e707e312d7c5d7d0f3b2f9)

---

### Pitfall SW3: Over-Caching on Install

**What goes wrong:** Precaching too many assets during install event causes:
- Slow first load (waiting for all assets)
- If ANY asset fails, entire SW installation fails
- Wasted bandwidth on assets user never needs

**Why it happens:** Following "cache everything" tutorials without considering app size.

**Consequences:**
- First visit takes 30+ seconds on slow connections
- Installation fails silently on network hiccups
- Users blame app for "being slow"

**Prevention:**
1. Precache only critical app shell (HTML, core CSS/JS)
2. Lazy-cache other assets on first use
3. Set reasonable precache budget (< 5MB)
4. Handle individual cache failures gracefully

**Phase to address:** Service Worker Setup phase

**Source:** [web.dev Caching Guide](https://web.dev/learn/pwa/caching)

---

### Pitfall SW4: Update Detection Without Notification

**What goes wrong:** New service worker installs and waits, user never knows update exists, runs old version indefinitely.

**Why it happens:** Service worker lifecycle is invisible to users by default.

**Consequences:**
- Bug fixes don't reach users
- Features deployed but not visible
- Users on different versions cause support confusion

**Prevention:**
1. Listen for `updatefound` event
2. Show unobtrusive "Update available" banner
3. Provide "Update now" button that calls `skipWaiting()`
4. Handle `controllerchange` to refresh page

**Phase to address:** Service Worker Setup phase

---

### Pitfall SW5: StaleWhileRevalidate + skipWaiting Race Condition

**What goes wrong:** When using Stale-While-Revalidate caching and skipWaiting together, long-running fetch requests can block the new service worker from activating. User sees "Update available" but clicking does nothing.

**Why it happens:** Service worker waits for all in-flight requests to complete before activation. A slow API call or large download keeps the old worker alive.

**Consequences:**
- Updates appear stuck
- Users repeatedly click "Update" with no effect
- Frustration and perceived app instability

**Prevention:**
1. Set reasonable timeouts on fetch requests
2. Consider aborting long-running requests on update
3. Use a hybrid approach: shorter timeout for update-blocking requests
4. Test update flow with slow network simulation

**Phase to address:** Service Worker Setup phase

**Source:** [skipWaiting with StaleWhileRevalidate](https://allanchain.github.io/blog/post/pwa-skipwaiting/)

---

## Offline Sync Pitfalls

### Pitfall OS1: No Message Idempotency Keys

**What goes wrong:** Same message sent multiple times when:
- Network timeout triggers retry
- User refreshes during pending send
- Background sync fires multiple times

**Why it happens:** Server creates new message for each POST request.

**Consequences:**
- Duplicate messages in channel
- User embarrassment
- Data integrity issues

**Prevention:**
1. Generate UUID/ULID client-side when user creates message
2. Include idempotency key in all POST requests
3. Server checks: if key exists, return existing message
4. Never generate message ID server-side for user-created content

**Phase to address:** Offline Queue phase

**Source:** [Ably Chat Architecture](https://ably.com/blog/chat-architecture-reliable-message-ordering)

---

### Pitfall OS2: Optimistic UI Without Rollback

**What goes wrong:** Show message as "sent" immediately, but sync fails and user doesn't notice.

**Why it happens:** Optimistic updates without error handling.

**Consequences:**
- User thinks message sent
- No indication of failure
- Message never delivered

**Prevention:**
1. Show distinct states: sending (spinner), sent (checkmark), failed (red X)
2. Failed messages show retry button
3. Failed messages persist across app restarts
4. Consider: keep failed messages at bottom of compose area

**Phase to address:** Offline Queue phase

---

### Pitfall OS3: Message Ordering Conflicts

**What goes wrong:** Offline messages interleave incorrectly with messages received after reconnect.

**Why it happens:** Using client timestamps without server reconciliation.

**Consequences:**
- Confusing conversation flow
- Replies appear before questions
- Context lost

**Prevention:**
1. Use server-assigned timestamps for canonical ordering
2. Client timestamps only for optimistic display
3. On sync: re-sort messages by server timestamp
4. Handle: local message created at T1, synced at T3, but T2 messages exist

**Phase to address:** Offline Queue phase

---

### Pitfall OS4: Sync Storms After Reconnect

**What goes wrong:** User comes online after extended offline period, app tries to sync thousands of queued operations simultaneously.

**Why it happens:** Queue processed without rate limiting.

**Consequences:**
- Server overwhelmed
- Rate limits triggered
- Other users' requests delayed
- App appears frozen

**Prevention:**
1. Process queue with rate limiting (e.g., 10 ops/second)
2. Batch where possible (send 10 messages in one request)
3. Prioritize: user's own pending sends first
4. Show sync progress indicator

**Phase to address:** Offline Queue phase

---

### Pitfall OS5: Conflict Resolution Silent Failures

**What goes wrong:** Server rejects message (e.g., channel was deleted while offline), client silently discards it.

**Why it happens:** Only handling network errors, not business logic errors.

**Consequences:**
- User's message disappears without explanation
- No opportunity to copy/paste to another channel
- Trust erosion

**Prevention:**
1. Distinguish network errors from server rejections
2. For rejections: show error with message content
3. Allow user to copy message text
4. Log conflicts for debugging
5. Consider: "Message could not be sent to #deleted-channel"

**Phase to address:** Offline Queue phase

---

## Push Notification Pitfalls

### Pitfall PN1: Sensitive Data in Push Payload

**What goes wrong:** Push payload contains message content, visible in:
- Lock screen to anyone nearby
- Notification history
- Push service logs (potential privacy issue)

**Why it happens:** Trying to show message preview in notification.

**Consequences:**
- Privacy breach
- Confidential messages exposed
- Compliance violations (healthcare, legal, etc.)

**Prevention:**
1. Push payload contains only: type, channel_id, sender_name
2. Fetch actual content when notification clicked
3. Let users configure: show preview vs. "New message from X"
4. For sensitive workspaces: always use generic notifications

**Phase to address:** Push Notification phase

---

### Pitfall PN2: iOS PWA Push Requires Home Screen Install

**What goes wrong:** Push notifications don't work at all for iOS users who haven't installed PWA.

**Why it happens:** Apple requires home screen installation for Web Push (iOS 16.4+).

**Consequences:**
- Users expect notifications, don't receive them
- Support tickets about "broken notifications"
- iOS users feel like second-class citizens

**Prevention:**
1. Detect iOS Safari
2. Gate notification setup behind install prompt
3. Clear messaging: "Install OComms to enable notifications"
4. Don't show notification permission UI until installed
5. Track: is this session running as installed PWA?

**Phase to address:** PWA Installation phase, Push Notification phase

**Source:** [Brainhub PWA on iOS](https://brainhub.eu/library/pwa-on-ios)

---

### Pitfall PN3: No Background Sync on iOS

**What goes wrong:** Background Sync API doesn't work on iOS, queued operations never sync if user doesn't reopen app.

**Why it happens:** Apple doesn't implement Background Sync to preserve battery.

**Consequences:**
- iOS users' offline messages stay pending indefinitely
- Different behavior than Android users
- Inconsistent experience

**Prevention:**
1. Don't rely on Background Sync for critical operations
2. Always retry queue on app foreground
3. Send push notification to bring user back to app
4. Consider: "You have unsent messages" notification

**Phase to address:** Offline Queue phase

**Source:** [MDN Offline and Background Operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)

---

### Pitfall PN4: VAPID Key Management for Self-Hosted

**What goes wrong:** Self-hosted instances share VAPID keys, or keys are regenerated on restart, breaking all existing push subscriptions.

**Why it happens:** VAPID keys generated at runtime without persistence.

**Consequences:**
- All push subscriptions invalidated on restart
- Users must re-enable notifications
- Confusion about "broken" notifications

**Prevention:**
1. Generate VAPID keys once during setup
2. Store in environment variables or config file
3. Document: "Do not change VAPID keys after users subscribe"
4. Include key persistence in backup/restore procedures

**Phase to address:** Push Notification phase

---

## iOS Safari Limitations

### Limitation iOS1: 50MB Storage Cap

**What:** iOS enforces ~50MB limit for PWA cache/IndexedDB (exact limit varies by device free space).

**Impact for OComms:**
- 7-day message cache may exceed limit on active workspaces
- Need aggressive cache eviction strategy
- Monitor storage with `navigator.storage.estimate()`

**Workaround:**
1. Implement LRU eviction for message cache
2. Prioritize: keep most recent 3 days, evict older
3. Store only metadata for old messages, fetch content on demand
4. Compress message content where possible

---

### Limitation iOS2: 100vh Viewport Bug

**What:** `100vh` includes Safari's address bar and bottom bar, causing content to be hidden.

**Impact for OComms:** Bottom tab bar navigation could be obscured.

**Workaround:**
```css
/* Use instead of 100vh */
.app-container {
  height: 100dvh; /* Dynamic viewport height - modern browsers */
  height: -webkit-fill-available; /* Fallback for older iOS */
}
```

---

### Limitation iOS3: No beforeinstallprompt Event

**What:** iOS Safari doesn't fire `beforeinstallprompt`, can't detect "installable" state or trigger install programmatically.

**Impact for OComms:** Can't show smart install banner, can't track install rates.

**Workaround:**
1. Detect iOS Safari via user agent
2. Show manual install instructions: "Tap Share > Add to Home Screen"
3. Use localStorage to track if user dismissed prompt
4. Consider: don't show again for 7 days after dismiss

---

### Limitation iOS4: No Persistent Notification Badge

**What:** iOS PWAs can't show badge count on home screen icon (unlike native apps).

**Impact for OComms:** Users can't see unread count at a glance.

**Workaround:**
1. Rely on push notifications for immediate alerts
2. Accept this limitation for PWA
3. Document limitation for users expecting native-like behavior

---

### Limitation iOS5: WebSocket Disconnection on Background

**What:** iOS aggressively suspends WebSocket connections when PWA goes to background.

**Impact for OComms:** Real-time messages stop arriving when app is backgrounded.

**Workaround:**
1. Handle WebSocket reconnection on visibility change
2. Fetch missed messages on foreground
3. Use push notifications for time-sensitive messages
4. Implement: `document.addEventListener('visibilitychange', reconnect)`

---

### Limitation iOS6: Safe Area Insets Required

**What:** iPhone notch and home indicator require safe area handling or content gets obscured.

**Impact for OComms:** Bottom tab bar could be hidden behind home indicator.

**Workaround:**
```css
/* Add to manifest.json */
"display": "standalone"

/* CSS safe area handling */
.tab-bar {
  padding-bottom: env(safe-area-inset-bottom);
}
.header {
  padding-top: env(safe-area-inset-top);
}
```

---

## IndexedDB Pitfalls

### Pitfall IDB1: QuotaExceededError Unhandled

**What goes wrong:** Storage write fails silently or crashes app when quota exceeded.

**Why it happens:** Not wrapping IndexedDB operations in try/catch.

**Consequences:**
- New messages fail to cache
- App appears broken
- Silent data loss

**Prevention:**
```javascript
try {
  await db.messages.put(message);
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    await evictOldMessages();
    await db.messages.put(message); // Retry
  } else {
    throw error;
  }
}
```

**Phase to address:** IndexedDB Setup phase

---

### Pitfall IDB2: No Cleanup Strategy

**What goes wrong:** IndexedDB grows unbounded until quota hit.

**Why it happens:** Only adding data, never removing.

**Consequences:**
- Eventually hits quota
- Performance degrades with size
- Mobile devices fill up

**Prevention:**
1. Define retention policy (7 days for OComms)
2. Run cleanup on app start
3. Track `lastAccessed` timestamp per record
4. Evict oldest first (LRU)
5. Set maximum record count per store

**Phase to address:** IndexedDB Setup phase

---

### Pitfall IDB3: Transaction Timeouts

**What goes wrong:** Long-running IndexedDB transaction auto-aborts.

**Why it happens:** Browser aborts transactions that stay open too long without activity.

**Consequences:**
- Partial data writes
- Inconsistent state
- Hard-to-debug errors

**Prevention:**
1. Keep transactions short
2. Don't do async work (fetch, setTimeout) inside transaction
3. Batch large operations
4. Use multiple small transactions instead of one large one

**Phase to address:** IndexedDB Setup phase

---

### Pitfall IDB4: Version Migration Failures

**What goes wrong:** IndexedDB schema upgrade fails, leaving database in broken state.

**Why it happens:** Error in `onupgradeneeded` handler, or version number conflicts.

**Consequences:**
- App can't open database
- User data inaccessible
- Requires clearing browser data to fix

**Prevention:**
1. Test all migration paths thoroughly
2. Keep migrations simple and idempotent
3. Handle partial migration failures gracefully
4. Consider: wipe and resync if migration fails
5. Log migration steps for debugging

**Phase to address:** IndexedDB Setup phase

---

## Prevention Matrix

| Pitfall | Phase | Prevention Strategy | Priority |
|---------|-------|---------------------|----------|
| C1: Auto skipWaiting | SW Setup | User-controlled updates | CRITICAL |
| C2: iOS 7-day eviction | PWA Install | Prompt home screen install | CRITICAL |
| C3: Offline queue loss | Offline Queue | Persist to IndexedDB immediately | CRITICAL |
| C4: Permission denied permanent | Push Notifications | Double-permission pattern | CRITICAL |
| SW1: Cache-first API | SW Caching | Network-first for user data | HIGH |
| SW2: Cached sw.js | SW Setup | no-cache headers | HIGH |
| SW3: Over-caching | SW Setup | Minimal precache | MEDIUM |
| SW4: Silent updates | SW Setup | Update notification UI | HIGH |
| SW5: SWR + skipWaiting race | SW Setup | Request timeouts | MEDIUM |
| OS1: No idempotency | Offline Queue | Client-generated UUIDs | CRITICAL |
| OS2: No rollback UI | Offline Queue | Message status indicators | HIGH |
| OS3: Ordering conflicts | Offline Queue | Server timestamps canonical | HIGH |
| OS4: Sync storms | Offline Queue | Rate limiting | MEDIUM |
| OS5: Silent rejections | Offline Queue | Error UI with content | MEDIUM |
| PN1: Sensitive payload | Push Notifications | Generic payloads only | HIGH |
| PN2: iOS install required | PWA Install | Gate behind install | HIGH |
| PN3: No background sync | Offline Queue | Foreground retry | HIGH |
| PN4: VAPID key loss | Push Notifications | Persistent key storage | HIGH |
| iOS1: 50MB limit | IndexedDB Setup | LRU eviction | HIGH |
| iOS2: 100vh bug | Mobile UI | Use 100dvh | MEDIUM |
| iOS3: No install prompt | PWA Install | Manual instructions | MEDIUM |
| iOS4: No badge | Push Notifications | Accept limitation | LOW |
| iOS5: WebSocket suspend | Real-time | Reconnect on visibility | HIGH |
| iOS6: Safe areas | Mobile UI | env() CSS variables | MEDIUM |
| IDB1: Quota unhandled | IndexedDB Setup | try/catch + eviction | HIGH |
| IDB2: No cleanup | IndexedDB Setup | Retention policy | HIGH |
| IDB3: Transaction timeout | IndexedDB Setup | Short transactions | MEDIUM |
| IDB4: Migration failure | IndexedDB Setup | Idempotent migrations | HIGH |

---

## Phase-Specific Warnings

| Phase | Primary Risks | Must Address |
|-------|---------------|--------------|
| Service Worker Setup | SW2, SW3, SW4, SW5 | Cache headers, minimal precache, update UI |
| Service Worker Caching | SW1, C1 | Strategy per resource type, user-controlled updates |
| IndexedDB Setup | IDB1, IDB2, IDB3, IDB4 | Quota handling, cleanup strategy, short transactions, migrations |
| Offline Queue | C3, OS1, OS2, OS3, OS4, OS5, PN3 | Persist immediately, idempotency, status UI, iOS fallback |
| PWA Installation | C2, PN2, iOS3 | Home screen prompt, iOS-specific messaging |
| Push Notifications | C4, PN1, PN4 | Double-permission, generic payloads, VAPID persistence |
| Mobile UI | iOS1, iOS2, iOS5, iOS6 | 100dvh, safe areas, reconnection logic |

---

## Quick Reference: Testing Checklist

Before shipping each PWA phase, verify:

### Service Worker
- [ ] sw.js served with `Cache-Control: no-cache`
- [ ] Update notification appears when new SW available
- [ ] User can defer update while typing
- [ ] Works with multiple tabs open

### Offline
- [ ] Message sent offline appears with "pending" indicator
- [ ] Message syncs when connection restored
- [ ] Duplicate send attempts don't create duplicates
- [ ] Failed messages show error and allow retry
- [ ] App reload doesn't lose queued messages

### iOS Safari
- [ ] App works without home screen install (graceful degradation)
- [ ] Install prompt shows with clear instructions
- [ ] After install: push notifications work
- [ ] 100vh content not cut off
- [ ] Safe areas respected on notched devices
- [ ] WebSocket reconnects after backgrounding

### Push Notifications
- [ ] Permission not requested until user action
- [ ] Works after browser restart
- [ ] Works after app update
- [ ] Generic notification shows for sensitive content
- [ ] Clicking notification opens correct conversation

### Storage
- [ ] App works after 7+ days of disuse (Safari)
- [ ] Graceful handling when quota exceeded
- [ ] Old messages cleaned up automatically
- [ ] Storage estimate logged for debugging

---

## Sources

### Official Documentation
- [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [MDN: Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [MDN: Push API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_Practices)
- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [web.dev: Storage for the web](https://web.dev/articles/storage-for-the-web)
- [web.dev: Push notification permissions UX](https://web.dev/articles/push-notifications-permissions-ux)
- [web.dev: PWA Caching](https://web.dev/learn/pwa/caching)
- [Chrome Developers: Workbox Caching Strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview)

### Architecture Guidance
- [Ably: Chat Architecture for Reliable Message Ordering](https://ably.com/blog/chat-architecture-reliable-message-ordering)
- [GTC Systems: Data Synchronization in PWAs](https://gtcsys.com/comprehensive-faqs-guide-data-synchronization-in-pwas-offline-first-strategies-and-conflict-resolution/)

### iOS-Specific
- [Brainhub: PWA on iOS - Limitations 2025](https://brainhub.eu/library/pwa-on-ios)
- [Vinova: Safari PWA Limitations](https://vinova.sg/navigating-safari-ios-pwa-limitations/)
- [firt.dev: iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/)

### Service Worker Patterns
- [Rich Harris: Things I wish I'd known about service workers](https://gist.github.com/Rich-Harris/fd6c3c73e6e707e312d7c5d7d0f3b2f9)
- [What Web Can Do: Handling Service Worker updates](https://whatwebcando.today/articles/handling-service-worker-updates/)
- [DEV.to: On PWA Update Patterns](https://dev.to/thepassle/on-pwa-update-patterns-4fgm)
- [skipWaiting with StaleWhileRevalidate](https://allanchain.github.io/blog/post/pwa-skipwaiting/)
- [RxDB: IndexedDB Max Storage Limit](https://rxdb.info/articles/indexeddb-max-storage-limit.html)

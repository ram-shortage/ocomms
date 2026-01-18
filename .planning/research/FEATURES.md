# Features Research: PWA & Mobile

**Domain:** Progressive Web App for self-hosted team chat
**Milestone:** v0.3.0 PWA/Mobile
**Researched:** 2026-01-18
**Confidence:** HIGH (verified against MDN documentation, web.dev guides, Slack/Discord mobile implementations)

---

## Executive Summary

PWA technology has matured significantly since iOS 16.4 added push notification support. A well-built PWA can now deliver a near-native experience on both Android and iOS, with the key differentiator being offline capability and install-to-home-screen flow. For a chat application, the critical features are offline message reading, reliable message queue for offline sends, and push notifications for mentions/DMs.

The planned OComms v0.3.0 feature set (offline cache, background sync, push notifications, bottom tab navigation) aligns well with PWA chat app expectations. The main risks are iOS limitations (storage caps, unreliable background sync) and the complexity of offline-first architecture.

---

## Table Stakes

Features users expect from a PWA chat application. Missing these = app feels broken or incomplete.

### Core PWA Functionality

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Install to home screen** | Defines PWA vs "just a website". Users expect dedicated app icon. | Low | Requires web app manifest, service worker. Custom install prompt recommended. |
| **Custom offline page** | Generic browser error is unacceptable. Users expect graceful degradation. | Low | Service worker intercepts failed requests, shows branded offline state. |
| **Fast initial load** | Installed apps must be "always fast". Sub-2-second paint expected. | Medium | Cache shell strategy, lazy load content. App shell architecture. |
| **Works without network** | Core PWA promise. At minimum, show cached content when offline. | High | Service worker + IndexedDB for messages. 7-day cache reasonable. |
| **Push notifications** | Chat apps need to alert users of new messages. Table stakes for chat. | High | Web Push API + VAPID keys. iOS requires home screen install first. |

### Offline Chat Specifics

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Read cached messages offline** | Users expect to review recent conversations without network | Medium | IndexedDB for messages, 7-day retention reasonable |
| **Compose messages offline** | Can't break the "write and send" flow just because network dropped | Medium | Queue locally, sync when online |
| **Offline message indicators** | Users need to know message hasn't sent yet | Low | Show pending icon, update to sent on sync |
| **Automatic sync on reconnect** | Queued messages should send automatically | High | Background Sync API or reconnection handler |

### Mobile UI Basics

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Bottom tab navigation** | Standard mobile pattern since Slack 2020 redesign. Thumb-reachable. | Medium | 3-5 tabs: Home, DMs, Mentions, Search, Profile |
| **Responsive layout** | Must work on phone screens. Desktop layout != mobile layout. | Medium | Dedicated mobile views, not just shrunk desktop |
| **Touch-optimized targets** | 44px minimum tap targets per Apple HIG | Low | Button sizing, spacing, hit areas |
| **Pull-to-refresh** | Expected pattern for content reload | Low | Standard gesture, visual feedback |
| **Keyboard handling** | Virtual keyboard must not break layout, input focus | Medium | Viewport handling, scroll-into-view for inputs |

---

## Differentiators

Features that create a native-like experience. Not expected from basic PWA, but valued.

### Native-Feel Interactions

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Swipe gestures on messages** | Native apps have swipe-to-reply, swipe-to-archive. Feels premium. | Medium | Swipe right to reply (Telegram), swipe left for actions. Needs careful implementation. |
| **Haptic feedback** | Vibration on actions confirms input. Native app feel. | Low | `navigator.vibrate()` on supported devices |
| **Smooth animations** | 60fps transitions between views. No jank. | Medium | CSS transforms, avoid layout thrashing |
| **Swipe between sections** | Swipe left/right to navigate tabs (Discord pattern) | Medium | Gesture navigation between main sections |
| **Long-press context menus** | Mobile-native action pattern | Medium | Replace right-click with long-press on mobile |

### Advanced Offline

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Optimistic UI updates** | Message appears instantly, syncs in background | Medium | Local-first architecture, conflict resolution |
| **Offline search** | Search through cached messages without network | High | Local IndexedDB search, limited scope |
| **Retry with backoff** | Failed sends retry intelligently, don't hammer server | Medium | Exponential backoff + jitter |
| **Sync conflict resolution** | Handle edits/deletes while offline gracefully | High | Last-write-wins or CRDT approach |

### Smart Notifications

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Notification preferences** | Per-channel: all, mentions only, none | Medium | Respects existing notification settings |
| **Notification grouping** | Collapse multiple messages into one notification | Medium | Show "3 new messages in #general" |
| **Quiet hours** | Respect DND settings for push delivery | Medium | Server-side check before sending push |
| **Click-to-open context** | Clicking notification opens specific conversation | Medium | Pass conversation ID in notification payload |

### Install Experience

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Custom install prompt** | More context than browser default, higher conversion | Low | Intercept `beforeinstallprompt`, show custom UI |
| **Install at right moment** | After sign-in or first message, not immediately | Low | Trigger based on engagement signals |
| **Update notification** | Tell users when new version available | Medium | Service worker update detection, prompt reload |
| **Dismissible install banner** | Respect "not now", remember preference | Low | Store dismissal in localStorage |

---

## Anti-Features

Features to explicitly NOT build. Either platform limitations, complexity traps, or wrong for self-hosted.

### Don't Build

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full offline mode (all data)** | iOS limits PWA storage to ~50MB, auto-clears after 7 days of inactivity | Cache 7 days of messages, clear old data proactively |
| **Background sync on iOS** | Background Sync API not supported on iOS Safari | Use reconnection handler on app foreground instead |
| **Native share target** | Complex, limited support, not critical for chat | Standard copy/paste, link sharing |
| **Badge API on iOS** | Not supported | Show unread in app title, notification count |
| **Periodic background sync** | Limited browser support, unreliable | Use push notifications to trigger data refresh |
| **Complex offline editing** | Conflict resolution is hard, edge cases abound | Allow offline compose, disable edit/delete offline |
| **Offline file upload** | Files too large to cache, complex resume logic | Show "upload when online" placeholder |
| **SMS/Email notification fallback** | Scope creep, different infrastructure | Web push only for v0.3.0 |

### iOS-Specific Limitations to Accept

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| **No install prompt** | Lower install rates than Android | Prominent "Add to Home Screen" instructions |
| **50MB storage cap** | Can't cache everything | Aggressive cache management, 7-day limit |
| **Storage cleared after 7 days** | Users may lose offline data | Clear warning, re-fetch on app open |
| **Push requires home screen install** | Can't push to Safari-only users | Guide users to install first |
| **Service worker reliability issues** | Listeners may not fire after restart | Graceful fallback, don't depend on background execution |

### Complexity Traps

| Trap | Why Tempting | Why Dangerous |
|------|--------------|---------------|
| **"Sync everything offline"** | Completeness | Storage limits, sync complexity, stale data |
| **"Full IndexedDB replica"** | Performance | Migration hell, storage bloat, consistency bugs |
| **"Retry forever"** | Reliability | Battery drain, quota exhaustion, server load |
| **"Custom gesture system"** | Native feel | Conflicts with platform gestures, accessibility issues |
| **"Background location"** | Presence accuracy | Privacy nightmare, battery drain, scope creep |

---

## Mobile UI Patterns

### Navigation Structure

Based on Slack and Discord mobile implementations:

**Bottom Tab Bar (3-5 tabs):**
```
+-------+-------+-------+-------+-------+
|  Home |  DMs  | @You  |Search |  You  |
+-------+-------+-------+-------+-------+
```

| Tab | Purpose | Badge |
|-----|---------|-------|
| **Home** | Channel list with unreads bubbled to top | Total unread count |
| **DMs** | Direct message conversations | DM unread count |
| **@You / Mentions** | Mentions and reactions | Mention count |
| **Search** | Full-text search | None |
| **You / Profile** | Settings, status, logout | None (or notification if action needed) |

**Why this pattern:**
- Slack adopted bottom tabs in 2020 after years of hamburger menu, increased engagement
- Discord moved to bottom tabs for same reasons: discoverability, thumb reach
- 5 tabs is maximum recommended; 3-4 is ideal

### Channel/Conversation View

**Layout:**
```
+----------------------------------+
| <- Back    #channel-name    ...  |  (Header with back, title, overflow menu)
+----------------------------------+
|                                  |
|  Message bubbles                 |  (Scrollable message list)
|  with timestamps                 |
|                                  |
+----------------------------------+
| [+] Type a message...     [Send] |  (Composer, always visible)
+----------------------------------+
```

**Key patterns:**
- Back button to return to channel list (swipe-from-edge also works)
- Channel name in header, tap for channel info
- Overflow menu (...) for channel settings, mute, leave
- Composer pinned to bottom, grows with multiline input
- Send button replaces attach when text entered

### Swipe Gestures

Recommended gestures based on industry standards:

| Gesture | Action | Precedent |
|---------|--------|-----------|
| **Swipe right on message** | Reply to message | Telegram, WhatsApp, Discord |
| **Swipe left on conversation** | Archive/Mute/Delete options | Gmail, Slack |
| **Swipe from left edge** | Navigate back | iOS system gesture |
| **Pull down** | Refresh / Load older messages | Universal |
| **Long press on message** | Context menu (copy, edit, delete, react) | Universal |

**Caution:** Swipe-to-reply conflicts with edge-swipe navigation. Require swipe to start on message bubble, not from edge.

### Thread View (Mobile)

**Pattern:** Slide-in panel from right, or full-screen takeover

```
+----------------------------------+
| <- Thread    #channel-name       |
+----------------------------------+
| Original message                 |
| -------------------------------- |
| Reply 1                          |
| Reply 2                          |
| ...                              |
+----------------------------------+
| [+] Reply in thread...    [Send] |
+----------------------------------+
```

**Options:**
1. **Slide-in panel** - Maintains context, can be dismissed
2. **Full screen** - Simpler, used by Slack mobile

Recommend: Full screen for v0.3.0 (simpler), slide-in for later enhancement.

---

## Offline Patterns

### What SHOULD Work Offline

| Feature | Implementation | Rationale |
|---------|----------------|-----------|
| **Read cached messages** | IndexedDB message store, 7-day retention | Core offline value prop |
| **Compose and queue messages** | Local queue with pending status | Don't break the write flow |
| **View channel list** | Cache channel metadata | Navigation must work |
| **View user profiles** | Cache basic user info | Needed for message display |
| **See own unread state** | Cache read positions | Catch-up experience |
| **Access recently viewed content** | LRU cache strategy | Predictable behavior |

### What Should NOT Work Offline

| Feature | Why Not | What to Show |
|---------|---------|--------------|
| **Send messages immediately** | Requires network | Show "queued" indicator |
| **Search across all messages** | Data too large | Show "search available when online" |
| **Load new messages** | Requires network | Show "offline, showing cached" |
| **Upload files** | Too large to queue | Show "will upload when online" |
| **Edit/delete messages** | Conflict potential | Disable action, show "requires connection" |
| **Change settings** | Needs server sync | Disable or queue |
| **Real-time typing indicators** | Obviously needs network | Don't show |

### Message Queue Strategy

**Local-first architecture:**

```
User sends message
       |
       v
+----------------+
| Save to        |
| IndexedDB with |
| status=pending |
+----------------+
       |
       v
+----------------+
| Display in UI  |
| with pending   |
| indicator      |
+----------------+
       |
       v
+----------------+
| Attempt send   |
| via network    |
+----------------+
       |
  +----+----+
  |         |
  v         v
Success   Failure
  |         |
  v         v
Update    Retry with
status=   exponential
sent      backoff
```

**Queue requirements:**
- Unique client-generated ID (ULID or UUID) for deduplication
- Timestamp of creation for ordering
- Retry count for backoff calculation
- Status: pending, sending, sent, failed

**Retry strategy:**
- Initial delay: 1 second
- Backoff multiplier: 2x
- Max delay: 5 minutes
- Max retries: 10 (then mark failed, let user retry manually)
- Add jitter: +/- 20% to prevent thundering herd

### Cache Management

**What to cache:**
| Data Type | Cache Strategy | TTL | Max Size |
|-----------|---------------|-----|----------|
| App shell (HTML/CSS/JS) | Cache-first | Until new version | ~2MB |
| Messages | Network-first, cache fallback | 7 days | ~20MB |
| User profiles | Stale-while-revalidate | 1 day | ~1MB |
| Channel metadata | Stale-while-revalidate | 1 day | ~500KB |
| Images/avatars | Cache-first | 7 days | ~10MB |

**Storage budget:** ~35MB target, well under iOS 50MB limit

**Cache invalidation triggers:**
- New service worker deployed (clear old cache)
- User logs out (clear all user data)
- 7 days since last use (iOS will clear anyway)
- Manual cache clear in settings

---

## Push Notification Patterns

### Notification Types

| Type | When to Send | Priority | Group? |
|------|--------------|----------|--------|
| **Direct message** | New DM from any user | High | By conversation |
| **@mention** | User mentioned by name | High | By channel |
| **@channel/@here** | Channel-wide mention | Medium | By channel |
| **Thread reply** | Reply in followed thread | Medium | By thread |
| **Reaction** | Someone reacted to user's message | Low | Not sent (or very batched) |

### User Preferences

**Settings to expose:**

| Setting | Options | Default |
|---------|---------|---------|
| **All notifications** | On / Off | On |
| **DM notifications** | All / None | All |
| **Channel notifications** | All / Mentions / None | Mentions |
| **Thread notifications** | All replies / Mentions only / None | Mentions only |
| **Quiet hours** | Time range (e.g., 10pm-7am) | Off |
| **Weekend notifications** | On / Off | On |

**Per-channel overrides:**
- Allow users to mute specific channels
- Allow users to set specific channels to "all messages"

### Notification Content

**Best practices:**
- Show sender name and avatar
- Show channel/DM context
- Show message preview (truncated)
- Don't show sensitive content (respect settings)

**Example notification:**
```
[Avatar] John in #engineering
Hey @brett, can you review the PR?
```

### iOS-Specific Considerations

| Requirement | Reason | Implementation |
|-------------|--------|----------------|
| Must be installed to home screen | iOS restriction | Guide users to install before enabling push |
| User must grant permission | iOS restriction | Request after value demonstrated |
| Can be auto-cleared | iOS storage limits | Re-subscribe on app open |
| Click may not work reliably | Known Safari bug | Graceful fallback, test thoroughly |

### Permission Request Flow

**Don't:** Request permission on first visit

**Do:** Request after engagement signals
1. User signs in successfully
2. User sends first message or joins first channel
3. Show custom prompt explaining value: "Get notified when someone messages you?"
4. If accepted, request browser permission
5. If denied, don't ask again (or ask much later)

**Custom prompt pattern:**
```
+----------------------------------+
|  Stay in the loop                |
|                                  |
|  Get notified when you're        |
|  mentioned or receive DMs.       |
|                                  |
|  [Enable]         [Not now]      |
+----------------------------------+
```

---

## Install/Update Experience

### Install Prompt Strategy

**When to show:**
- After user signs in (strong signal of intent)
- After user sends first message (engagement)
- Never on first visit (no context)
- Never immediately after page load (annoying)

**Custom prompt benefits:**
- More context than browser default
- Can explain value proposition
- Can be dismissed and remembered
- Higher conversion rates

**Implementation:**
```javascript
// Capture browser prompt event
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show custom install UI when ready
});

// Later, when user is engaged
function showInstallPrompt() {
  // Show custom UI
  // On accept, call deferredPrompt.prompt()
}
```

### Update Experience

**Service worker update flow:**
1. Browser checks for new SW on navigation (or every 24h)
2. If new SW found, it installs in background
3. New SW waits until old SW releases (all tabs closed)
4. OR: Show "Update available" prompt, user clicks, `skipWaiting()` called

**Update prompt pattern:**
```
+----------------------------------+
|  Update available                |
|                                  |
|  A new version of OComms is      |
|  ready. Reload to update?        |
|                                  |
|  [Update now]      [Later]       |
+----------------------------------+
```

**Best practices:**
- Don't force update (user may have unsent messages)
- Show update prompt as dismissible banner
- Update automatically on next app start
- If critical security update, more prominent prompt

### iOS "Add to Home Screen" Guidance

Since iOS doesn't have install prompts, show guidance:

**Detection:** Check if running in standalone mode
```javascript
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone;
```

**If not installed, show banner:**
```
+----------------------------------+
|  Install OComms                  |
|                                  |
|  Tap [Share icon] then           |
|  "Add to Home Screen" for        |
|  the best experience.            |
|                                  |
|  [Got it]          [Show me how] |
+----------------------------------+
```

---

## Feature Dependencies

```
Service Worker (prerequisite for PWA)
  |
  +-- App Shell Caching (requires SW)
  |     |
  |     +-- Offline Page (requires App Shell)
  |
  +-- Message Caching (requires SW + IndexedDB)
  |     |
  |     +-- Offline Message Reading (requires Message Cache)
  |     |
  |     +-- Message Queue (requires Message Cache)
  |           |
  |           +-- Background Sync (requires Queue)
  |
  +-- Push Notifications (requires SW)
        |
        +-- Notification Preferences (requires Push)
        |
        +-- Click-to-Open (requires Push + Routing)

Web App Manifest (parallel to SW)
  |
  +-- Install Prompt (requires Manifest + SW)
  |
  +-- Home Screen Icon (requires Manifest)
  |
  +-- Standalone Display (requires Manifest)

Mobile UI (parallel to PWA)
  |
  +-- Bottom Tab Navigation (requires Routing)
  |
  +-- Responsive Layout (requires CSS)
  |
  +-- Touch Gestures (requires event handling)
```

---

## MVP Recommendation

For v0.3.0 "PWA/Mobile" milestone:

### Must Ship (MVP Core)

1. **Service worker with app shell caching** - Basic PWA functionality
2. **Custom offline page** - Graceful offline experience
3. **Message caching (7 days)** - Core offline value
4. **Message queue with retry** - Don't break send flow
5. **Web Push notifications** - DMs and mentions
6. **Bottom tab navigation** - Mobile-first navigation
7. **Web app manifest** - Installable PWA
8. **Custom install prompt** - Higher conversion

### Should Ship (MVP Complete)

9. **Notification preferences** - Per-channel controls
10. **Update notification** - Service worker updates
11. **Swipe-to-reply gesture** - Native feel
12. **Offline indicators** - Clear status communication
13. **iOS install guidance** - Platform-specific help
14. **Quiet hours** - Respect DND settings

### Could Defer (Nice-to-Have)

15. **Swipe between tabs** - Can use taps only
16. **Notification grouping** - Basic notifications work
17. **Offline search** - Complex, limited value
18. **Background Fetch** - Limited support

---

## Sources

### Primary Sources (HIGH confidence)
- [MDN: PWA Best Practices](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices)
- [MDN: Offline and Background Operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [web.dev: Installation Prompt](https://web.dev/learn/pwa/installation-prompt)
- [web.dev: Customize Install](https://web.dev/articles/customize-install)
- [web.dev: Promote Install Patterns](https://web.dev/articles/promote-install)

### Mobile UI Patterns (HIGH confidence)
- [Slack Design: Re-designing Slack Mobile](https://slack.design/articles/re-designing-slack-on-mobile/)
- [Discord: Android Navigation Redesign](https://discord.com/blog/how-discord-made-android-in-app-navigation-easier)
- [Bottom Tab Bar Best Practices](https://uxdworld.com/bottom-tab-bar-navigation-design-best-practices/)
- [Chat UI Design Patterns](https://bricxlabs.com/blogs/message-screen-ui-deisgn)

### Offline Patterns (MEDIUM-HIGH confidence)
- [Offline-First Sync Patterns](https://developersvoice.com/blog/mobile/offline-first-sync-patterns/)
- [GetStream: Offline Chat](https://getstream.io/glossary/offline-chat/)
- [NN/g: Swipe Gestures](https://www.nngroup.com/articles/contextual-swipe/)

### Push Notifications (MEDIUM-HIGH confidence)
- [MDN: Push API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_Practices)
- [PushAlert: Web Push Best Practices](https://pushalert.co/blog/web-push-notifications-best-practices/)
- [Push Notification Consent Guide](https://www.anstrex.com/blog/the-ultimate-guide-to-push-notification-consent-in-2025)

### iOS Limitations (MEDIUM-HIGH confidence)
- [Brainhub: PWA on iOS 2025](https://brainhub.eu/library/pwa-on-ios)
- [Vinova: Safari PWA Limitations](https://vinova.sg/navigating-safari-ios-pwa-limitations/)
- [iOS Push Requirements](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)

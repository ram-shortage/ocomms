# Phase 18: Push Notifications - Research

**Researched:** 2026-01-19
**Domain:** Web Push Notifications (VAPID, Service Worker Push Events, Notification API)
**Confidence:** HIGH

## Summary

This research covers implementing Web Push notifications in a Next.js application that already has a service worker configured via Serwist. The standard approach is to use the **web-push** npm library for server-side push delivery with VAPID authentication, and extend the existing service worker to handle push events.

Key findings:
- The `web-push` library is the established standard for Node.js Web Push (handles VAPID, encryption, delivery)
- Push subscriptions must be stored in the database (endpoint, p256dh, auth keys)
- Service worker needs `push` and `notificationclick` event listeners
- The "double permission pattern" improves conversion (ask in-app first, then browser permission)
- Safari/iOS has significant limitations (requires PWA installation, limited features)
- VAPID keys should be generated once and stored in environment variables

**Primary recommendation:** Use `web-push` library for server-side delivery, extend the existing Serwist service worker with push/notificationclick handlers, store subscriptions in a new `push_subscriptions` table, and implement the double-permission pattern in the UI.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| web-push | latest | Server-side push notification sending | De facto standard for Node.js VAPID/Web Push |
| Serwist (existing) | 9.5.0 | Service worker management | Already installed, provides SW infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workbox-window (existing) | 7.x | Service worker registration | Already installed for SW update detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| web-push | web-push-browser | Newer, zero-dep, but less proven/documented |
| web-push | Firebase Cloud Messaging | Vendor lock-in, more complex setup |
| web-push | OneSignal/Pusher | Third-party service, not self-hosted |

**Installation:**
```bash
npm install web-push
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── sw.ts                           # Extend with push event handlers
│   └── api/
│       └── push/
│           ├── vapid-public/route.ts   # Expose public VAPID key
│           ├── subscribe/route.ts      # Store push subscriptions
│           └── unsubscribe/route.ts    # Remove push subscriptions
├── db/
│   └── schema/
│       └── push-subscription.ts        # New table for subscriptions
├── lib/
│   └── push/
│       ├── server.ts                   # web-push configuration
│       ├── send.ts                     # Push notification sending
│       └── vapid.ts                    # VAPID key management
├── components/
│   └── push/
│       ├── PushPermissionPrompt.tsx    # Double-permission UI
│       └── PushSettings.tsx            # Per-channel settings UI
└── server/
    └── socket/
        └── handlers/
            └── notification.ts         # Extend to trigger push
```

### Pattern 1: VAPID Key Management
**What:** Generate VAPID keys once, store in environment variables
**When to use:** Server startup, configuration
**Example:**
```typescript
// lib/push/vapid.ts
// Source: https://github.com/web-push-libs/web-push
import webpush from "web-push";

// Generate keys once: npx web-push generate-vapid-keys
// Store in environment variables

export function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT; // mailto: or https: URI

  if (!publicKey || !privateKey || !subject) {
    console.warn("[Push] VAPID keys not configured - push notifications disabled");
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}
```

### Pattern 2: Push Subscription Storage
**What:** Store browser push subscriptions in database per user
**When to use:** When user enables push notifications
**Example:**
```typescript
// db/schema/push-subscription.ts
// Source: https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription
import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(), // Push service URL
  p256dh: text("p256dh").notNull(),     // Public key (~88 chars Base64)
  auth: text("auth").notNull(),          // Auth secret (~24 chars Base64)
  userAgent: text("user_agent"),         // Browser identifier
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // One subscription per endpoint (user may have multiple devices)
  uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint),
]);
```

### Pattern 3: Service Worker Push Event Handler
**What:** Handle incoming push messages and show notifications
**When to use:** In service worker, extends existing sw.ts
**Example:**
```typescript
// src/app/sw.ts additions
// Source: https://web.dev/articles/push-notifications-handling-messages

// Add to existing sw.ts after serwist.addEventListeners()

self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("[SW] Push received but no data");
    return;
  }

  const data = event.data.json();
  const { title, body, icon, data: notificationData } = data;

  const options: NotificationOptions = {
    body,
    icon: icon || "/icons/icon-192x192.png",
    badge: "/icons/badge-96x96.png",
    data: notificationData, // Contains URL for click handling
    tag: notificationData?.tag, // Dedup notifications by tag
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
```

### Pattern 4: Notification Click Handler with Deep Linking
**What:** Open specific conversation/channel when notification clicked
**When to use:** In service worker
**Example:**
```typescript
// src/app/sw.ts additions
// Source: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Check if URL already open in a tab
        const matchingClient = windowClients.find(
          (client) => client.url === url
        );

        if (matchingClient) {
          return matchingClient.focus();
        }

        // Open new window if no matching tab
        return clients.openWindow(url);
      })
  );
});
```

### Pattern 5: Double Permission Pattern
**What:** In-app prompt before browser permission request
**When to use:** First time asking user to enable push
**Example:**
```typescript
// components/push/PushPermissionPrompt.tsx
// Source: https://www.smashingmagazine.com/2019/04/privacy-better-notifications-ux-permission-requests/
"use client";

export function PushPermissionPrompt({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Enable Notifications?</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Get notified when you receive a direct message or someone mentions you.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={onAccept}>Enable Notifications</Button>
        <Button variant="ghost">Not Now</Button>
      </div>
    </div>
  );
}

// When user clicks "Enable Notifications":
async function requestPushPermission() {
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    // Send subscription to server
    await fetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription.toJSON()),
    });
  }
}
```

### Pattern 6: Sending Push Notifications
**What:** Server-side push delivery when notification triggered
**When to use:** In notification handler, after creating in-app notification
**Example:**
```typescript
// lib/push/send.ts
// Source: https://www.npmjs.com/package/web-push
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data: {
    url: string;
    tag?: string;
  };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, userId),
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 } // 24 hours
        );
      } catch (error: any) {
        // 410 Gone or 404 = subscription expired, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        }
        throw error;
      }
    })
  );

  return results;
}
```

### Anti-Patterns to Avoid
- **Requesting permission immediately on page load:** Conversion drops dramatically. Use double-permission pattern.
- **Not handling expired subscriptions:** 410/404 responses mean subscription is dead - delete from database.
- **Hardcoding VAPID keys:** Keys must be in environment variables, never in code.
- **Not using `event.waitUntil()`:** Service worker may terminate before notification shows.
- **Ignoring notification settings:** Check user's channel preference (all/mentions/muted) before sending push.
- **Sending push to sender:** Don't send push notification for your own messages.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VAPID key generation | Manual crypto | `npx web-push generate-vapid-keys` | Complex key format, easy to get wrong |
| Push encryption | Custom encryption | web-push library | RFC 8188 encryption is complex |
| Subscription management | Manual endpoint tracking | PushSubscription.toJSON() | Handles all keys/encoding properly |
| Deep linking | Manual URL parsing | Notification.data + clients.openWindow | Browser handles window focus/open |

**Key insight:** Web Push encryption and VAPID signing are complex cryptographic operations with specific formats. The web-push library handles all of this correctly.

## Common Pitfalls

### Pitfall 1: Safari localhost VAPID rejection
**What goes wrong:** Safari rejects push requests with https://localhost subject
**Why it happens:** Safari validates VAPID subject strictly
**How to avoid:** Use `mailto:` format for VAPID subject: `mailto:admin@yourdomain.com`
**Warning signs:** BadJwtToken error on Safari only

### Pitfall 2: iOS PWA-only push
**What goes wrong:** Push subscription fails on iOS Safari
**Why it happens:** iOS only allows push for installed PWAs (home screen)
**How to avoid:**
  - Detect iOS and show "Add to Home Screen" instructions before push prompt
  - Check for standalone display mode before enabling push
**Warning signs:** PushManager not available on iOS Safari

### Pitfall 3: Stale subscriptions
**What goes wrong:** Push delivery failures accumulate over time
**Why it happens:** Users uninstall browser, clear data, or subscription expires
**How to avoid:** Handle 410/404 responses by deleting subscription from database
**Warning signs:** Increasing push failure rate

### Pitfall 4: Missing notification tag deduplication
**What goes wrong:** Multiple notifications for same conversation spam user
**Why it happens:** Not using notification tag for grouping
**How to avoid:** Set `tag` option to conversation/channel ID - browser replaces existing notification with same tag
**Warning signs:** Multiple notifications from same chat

### Pitfall 5: Notification not showing
**What goes wrong:** Push received but no notification appears
**Why it happens:** Missing `event.waitUntil()` or `showNotification()` promise not awaited
**How to avoid:** Always wrap async work in `event.waitUntil()`
**Warning signs:** Push event fires but notification never shows

### Pitfall 6: No fallback for denied permission
**What goes wrong:** User denied permission and can't re-enable
**Why it happens:** Browser remembers denial, app doesn't explain how to fix
**How to avoid:**
  - Show instructions for re-enabling in browser settings
  - Store permission state to avoid re-prompting denied users
**Warning signs:** Users report can't enable notifications

## Code Examples

Verified patterns from official sources:

### Convert VAPID Public Key for Client
```typescript
// Source: https://github.com/nicola/nicola.io/blob/master/public/push.js
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

### Check Push Support
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isIOSStandalone(): boolean {
  return (
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isPushAvailable(): boolean {
  // iOS only supports push in standalone (installed) mode
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    return isPushSupported() && isIOSStandalone();
  }
  return isPushSupported();
}
```

### Environment Variables Setup
```bash
# .env additions
# Generate with: npx web-push generate-vapid-keys

# VAPID keys for Web Push
VAPID_PUBLIC_KEY=your-public-key-here
VAPID_PRIVATE_KEY=your-private-key-here
VAPID_SUBJECT=mailto:admin@yourdomain.com

# Client-accessible public key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-key-here
```

### Notification Payload Structure
```typescript
// Recommended payload structure for push notifications
interface PushNotificationPayload {
  title: string;           // "New message from Alice"
  body: string;            // "Hey, are you available for a call?"
  icon?: string;           // "/icons/icon-192x192.png"
  badge?: string;          // "/icons/badge-96x96.png" (monochrome for status bar)
  data: {
    url: string;           // "/workspace/abc/channels/general" or "/workspace/abc/dm/conv123"
    tag: string;           // "channel:general" or "dm:conv123" (for grouping)
    type: "dm" | "mention" | "channel";
    messageId?: string;    // For deep linking to specific message
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GCM API keys | VAPID (Web Push) | 2016+ | Standard way to identify server |
| No iOS support | iOS 16.4+ PWA push | March 2023 | iOS now supports push (with caveats) |
| aesgcm encryption | aes128gcm (default) | RFC 8291 | web-push handles automatically |
| Always prompt permission | Double-permission pattern | UX best practice | Higher conversion rates |

**Recent developments:**
- Safari 18.5 (2025): Declarative Web Push - simplified API, less JS required
- iOS 16.4+: Web Push supported for installed PWAs only
- Firefox/Chrome: Full Web Push support in all contexts

**Deprecated/outdated:**
- GCM API keys: Legacy, VAPID is the standard
- `aesgcm` content encoding: `aes128gcm` is current default

## Open Questions

Things that couldn't be fully resolved:

1. **Safari Declarative Web Push (Safari 18.5)**
   - What we know: Apple announced simplified push API in WWDC 2025
   - What's unclear: Browser support status, backward compatibility
   - Recommendation: Use standard Web Push API, monitor for adoption

2. **iOS notification deep linking reliability**
   - What we know: Some reports of iOS not deep linking correctly
   - What's unclear: Whether this is fixed in recent iOS versions
   - Recommendation: Test thoroughly on iOS, may only navigate to start_url

3. **Multi-device subscription cleanup**
   - What we know: Users may have many stale subscriptions across devices
   - What's unclear: Best practice for limiting subscriptions per user
   - Recommendation: Consider limit (e.g., 5 devices) and cleanup oldest on new subscribe

## Sources

### Primary (HIGH confidence)
- [web-push npm](https://www.npmjs.com/package/web-push) - Official library documentation
- [web-push GitHub](https://github.com/web-push-libs/web-push) - Full API reference
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) - Web standard reference
- [MDN notificationclick event](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event) - Click handling
- [MDN showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) - Notification options
- [MDN PushSubscription](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription) - Subscription storage fields

### Secondary (MEDIUM confidence)
- [web.dev Push Notifications](https://web.dev/articles/push-notifications-handling-messages) - Implementation patterns
- [web.dev Common Notification Patterns](https://web.dev/articles/push-notifications-common-notification-patterns) - Deep linking
- [Apple Web Push Documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers) - Safari requirements
- [Brainhub PWA on iOS 2025](https://brainhub.eu/library/pwa-on-ios) - iOS limitations
- [Smashing Magazine Privacy UX](https://www.smashingmagazine.com/2019/04/privacy-better-notifications-ux-permission-requests/) - Double permission pattern

### Tertiary (LOW confidence)
- Various Medium/dev.to articles on Next.js push implementation
- Community discussions on Safari push limitations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - web-push is clearly the standard, extensively documented
- Architecture: HIGH - Patterns verified against MDN and official docs
- Pitfalls: HIGH - Well-documented issues with clear solutions
- iOS limitations: MEDIUM - Community reports, some variance in behavior

**Research date:** 2026-01-19
**Valid until:** 60 days (Web Push APIs are stable, iOS support may evolve)

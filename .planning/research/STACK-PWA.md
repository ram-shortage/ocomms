# Stack Research: PWA & Mobile

**Project:** OComms v0.3.0 - PWA & Mobile Enhancement
**Researched:** 2025-01-18
**Focus:** PWA capabilities for existing Next.js 15 App Router application

---

## Recommendations Summary

| Layer | Choice | Version | Why |
|-------|--------|---------|-----|
| Service Worker | **Serwist** | ^9.5.0 | Maintained successor to next-pwa, recommended in official Next.js docs, App Router native |
| IndexedDB | **Dexie.js** | ^4.2.1 | Superior DX, reactive queries with `useLiveQuery()`, TypeScript-first, handles migrations |
| Push Notifications | **web-push** | ^3.6.7 | Standard VAPID implementation, no external dependencies, used in Next.js official PWA guide |
| Background Sync | **Serwist (built-in)** | - | Workbox-based background sync included in Serwist |

---

## Service Worker: Serwist

### Why Serwist

1. **Official recommendation** - Listed in [Next.js PWA documentation](https://nextjs.org/docs/app/guides/progressive-web-apps) as the recommended approach
2. **Actively maintained** - v9.5.0 published January 2025, regular updates
3. **App Router native** - Built specifically for `app/` directory structure
4. **Workbox foundation** - All Workbox caching strategies available
5. **TypeScript-first** - Full type definitions included

### Confidence: HIGH
Source: [Official Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [Serwist Documentation](https://serwist.pages.dev/docs/next/getting-started)

### Installation

```bash
npm i @serwist/next && npm i -D serwist
```

### Configuration

**next.config.mjs:**
```javascript
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision: "1" }],
});

export default withSerwist({
  // existing Next.js config
});
```

**app/sw.ts:**
```typescript
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

**tsconfig.json additions:**
```json
{
  "compilerOptions": {
    "types": ["@serwist/next/typings"],
    "lib": ["webworker", "dom"]
  }
}
```

### Turbopack Compatibility

**Important:** Serwist requires webpack for service worker compilation.

- **Production builds:** Work normally (Next.js uses webpack for production)
- **Development with PWA testing:** Use `next dev --webpack`
- **Normal development:** PWA functionality typically disabled anyway

Since OComms uses a custom server (`tsx watch src/server/index.ts`), this is not a concern for the current setup.

---

## IndexedDB: Dexie.js

### Why Dexie.js (not idb)

| Factor | Dexie.js | idb |
|--------|----------|-----|
| Bundle size | ~30KB | ~1.2KB |
| Learning curve | Minimal | Requires IndexedDB knowledge |
| Querying | Rich `.where()`, `.filter()`, compound indexes | Raw IndexedDB API |
| Reactivity | `useLiveQuery()` hook built-in | Manual subscription |
| Migrations | Built-in versioning system | Manual |
| React integration | `dexie-react-hooks` | None |
| TypeScript | First-class with `EntityTable<T>` | Good |

**Decision:** Dexie.js. The extra bundle size is worth it for:
- Reactive queries that auto-update React components
- Clean migration system for schema changes
- Developer experience that doesn't require deep IndexedDB knowledge
- OComms needs complex queries (messages by channel, date ranges, search)

### Confidence: HIGH
Source: [Dexie.js GitHub](https://github.com/dexie/Dexie.js), [npm package](https://www.npmjs.com/package/dexie), [useLiveQuery documentation](https://dexie.org/docs/dexie-react-hooks/useLiveQuery())

### Installation

```bash
npm i dexie dexie-react-hooks
```

### Schema Design for OComms

```typescript
import Dexie, { type EntityTable } from 'dexie';

interface CachedMessage {
  id: string;
  channelId: string;
  content: string;
  authorId: string;
  createdAt: Date;
  cachedAt: Date;
}

interface PendingMessage {
  id: string;
  channelId: string;
  content: string;
  status: 'pending' | 'sending' | 'failed';
  createdAt: Date;
  retryCount: number;
}

interface CachedChannel {
  id: string;
  name: string;
  workspaceId: string;
  lastSyncedAt: Date;
}

const db = new Dexie('ocomms-offline') as Dexie & {
  messages: EntityTable<CachedMessage, 'id'>;
  pendingMessages: EntityTable<PendingMessage, 'id'>;
  channels: EntityTable<CachedChannel, 'id'>;
};

db.version(1).stores({
  messages: 'id, channelId, createdAt, [channelId+createdAt]',
  pendingMessages: 'id, channelId, status, createdAt',
  channels: 'id, workspaceId, lastSyncedAt',
});

export { db };
```

### Reactive Usage in Components

```typescript
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/offline-db';

function ChannelMessages({ channelId }: { channelId: string }) {
  const messages = useLiveQuery(
    () => db.messages
      .where('channelId')
      .equals(channelId)
      .sortBy('createdAt'),
    [channelId]
  );

  if (!messages) return <Loading />;
  return <MessageList messages={messages} />;
}
```

### Cache Expiry (7 days)

```typescript
async function cleanupOldMessages() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await db.messages
    .where('cachedAt')
    .below(sevenDaysAgo)
    .delete();
}
```

---

## Push Notifications: web-push

### Why web-push (not Firebase/OneSignal)

| Factor | web-push | Firebase FCM | OneSignal |
|--------|----------|--------------|-----------|
| Self-hosted | Yes | No (Google servers) | No |
| Data sovereignty | Full control | Data passes through Google | Third-party |
| Cost | Free | Free tier, then paid | Free tier, then paid |
| Complexity | Medium | Low | Low |
| Vendor lock-in | None | High | High |

**Decision:** web-push. OComms' core value is data sovereignty. Using Google or third-party push services contradicts this. VAPID-based web push sends directly to browser push services without intermediaries storing message content.

### Confidence: HIGH
Source: [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [web-push npm](https://www.npmjs.com/package/web-push)

### Installation

```bash
npm i web-push
npm i -g web-push  # For VAPID key generation CLI
```

### VAPID Key Generation

```bash
web-push generate-vapid-keys
```

Output:
```
Public Key: BNxL...
Private Key: aN3...
```

Add to `.env`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxL...
VAPID_PRIVATE_KEY=aN3...
VAPID_EMAIL=mailto:admin@your-ocomms-instance.com
```

### Server Implementation

**app/actions/push.ts:**
```typescript
'use server';

import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; url?: string }
) {
  await webpush.sendNotification(
    subscription,
    JSON.stringify(payload)
  );
}
```

### iOS Safari Requirements

Push notifications work on iOS 16.4+ **only when installed as PWA**:

1. User must "Add to Home Screen"
2. App must have `display: standalone` in manifest
3. Permission prompt must be triggered by user action (button tap)
4. Works on lock screen, Notification Center, Apple Watch

**Important:** Cannot prompt for push permission from Safari browser on iOS. Must be installed PWA.

---

## Background Sync: Serwist (Workbox)

### Built-in Background Sync

Serwist includes Workbox's background sync module. No additional package needed.

### Confidence: HIGH
Source: [Workbox Background Sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync), [Serwist GitHub](https://github.com/serwist/serwist)

### Implementation Pattern

**In service worker (app/sw.ts):**
```typescript
import { BackgroundSyncPlugin } from 'serwist';

const bgSyncPlugin = new BackgroundSyncPlugin('ocomms-message-queue', {
  maxRetentionTime: 24 * 60, // Retry for 24 hours (in minutes)
});

// Add to message POST route caching strategy
const serwist = new Serwist({
  // ... other config
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/messages'),
      handler: 'NetworkOnly',
      options: {
        plugins: [bgSyncPlugin],
      },
    },
  ],
});
```

### Fallback for Unsupported Browsers

Background Sync API is not supported in all browsers (notably Safari). Serwist automatically falls back to retry on service worker activation.

**OComms should also implement application-level retry:**
- Store pending messages in Dexie `pendingMessages` table
- Retry on reconnection via Socket.IO
- Show "pending" status in UI

---

## Web Manifest

### Native Next.js Support (No Library Needed)

Next.js 15 has built-in manifest support via `app/manifest.ts`.

### Confidence: HIGH
Source: [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps)

**app/manifest.ts:**
```typescript
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OComms',
    short_name: 'OComms',
    description: 'Self-hosted team chat',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

---

## What NOT to Use

### next-pwa

**Status:** Abandoned (last update 2+ years ago)
**Alternative:** Serwist (direct successor)
**Source:** [next-pwa npm](https://www.npmjs.com/package/next-pwa), community consensus

### @ducanh2912/next-pwa

**Status:** Deprecated in favor of Serwist (same maintainer)
**Alternative:** Serwist
**Source:** [Serwist documentation](https://serwist.pages.dev)

### Firebase Cloud Messaging

**Why not:** Contradicts OComms' data sovereignty mission. Messages pass through Google servers.
**Alternative:** web-push with VAPID

### OneSignal / Pusher Beams

**Why not:** Third-party services that store push data. Adds external dependency.
**Alternative:** web-push with VAPID

### localForage

**Why not:** Simple key-value store, insufficient for complex message queries. Dexie.js provides better querying and reactivity.
**Alternative:** Dexie.js

### idb

**Why not:** Too low-level for OComms' needs. Would require significant boilerplate for message caching, queries, migrations.
**Alternative:** Dexie.js (worth the bundle size for DX and features)

### RxDB

**Why not:** Overkill for offline cache use case. Designed for full sync/replication which OComms handles via Socket.IO.
**Alternative:** Dexie.js

---

## Complete Installation

```bash
# PWA & Service Worker
npm i @serwist/next
npm i -D serwist

# IndexedDB
npm i dexie dexie-react-hooks

# Push Notifications
npm i web-push
```

**No need to install:**
- Web manifest (built into Next.js)
- Background sync (included in Serwist)

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Serwist for Service Worker | HIGH | Official Next.js docs, active maintenance, verified setup |
| Dexie.js for IndexedDB | HIGH | Well-documented, active maintenance, clear React integration |
| web-push for notifications | HIGH | Used in Next.js official guide, standard VAPID implementation |
| Background sync approach | MEDIUM | Workbox module works, but Safari fallback needs custom implementation |
| iOS PWA push support | HIGH | Verified iOS 16.4+ support, documented requirements |

---

## Roadmap Implications

### Phase 1: Foundation
- Install Serwist, configure basic service worker
- Add web manifest
- Create offline fallback page

### Phase 2: Offline Data
- Implement Dexie.js schema
- Build message caching layer
- Add offline UI indicators

### Phase 3: Offline Send
- Implement pending message queue in Dexie
- Add background sync for POST requests
- Build optimistic UI updates

### Phase 4: Push Notifications
- Generate and store VAPID keys
- Implement subscription management
- Build notification preferences UI
- Add push for mentions/DMs

### Phase 5: Mobile UX
- Add bottom tab bar navigation
- Implement pull-to-refresh
- Optimize touch targets

---

## Sources

- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps) - Official documentation
- [Serwist Documentation](https://serwist.pages.dev/docs/next/getting-started) - Service worker setup
- [Dexie.js](https://dexie.org/) - IndexedDB wrapper
- [dexie-react-hooks](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()) - React integration
- [web-push npm](https://www.npmjs.com/package/web-push) - Push notifications
- [Workbox Background Sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync) - Background sync patterns
- [PWA on iOS 2025](https://brainhub.eu/library/pwa-on-ios) - iOS PWA limitations and capabilities

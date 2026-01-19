# Phase 16: Message Caching - Research

**Researched:** 2026-01-19
**Domain:** IndexedDB, Offline-First Caching, PWA Data Persistence
**Confidence:** HIGH

## Summary

This research covers implementing message caching in IndexedDB for offline reading in a Next.js PWA that already has service worker infrastructure (Serwist from Phase 15). The standard approach is to use **Dexie.js** as the IndexedDB wrapper, which provides a React-friendly API via `useLiveQuery()` for reactive data binding.

Key findings:
- Dexie.js is the recommended IndexedDB wrapper for React applications - it provides reactive hooks, TypeScript support, cross-tab synchronization, and bulk operations
- IndexedDB has no built-in TTL/expiration mechanism - 7-day retention must be implemented manually using timestamp indexes and cleanup queries
- The existing Message interface from `socket-events.ts` can be directly mapped to Dexie schema
- Cross-tab synchronization is automatic with Dexie 3.1+ via the `storagemutated` event
- Safari's 7-day inactivity deletion is a browser limitation (separate from our 7-day retention requirement)

**Primary recommendation:** Use Dexie.js 4.x with dexie-react-hooks for IndexedDB operations. Store messages when they arrive via Socket.io events and when loading channel pages. Implement TTL cleanup on app initialization by querying messages where `cachedAt < 7 days ago`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dexie | 4.x | IndexedDB wrapper | Kick-ass performance, React hooks, TypeScript-first, 787K weekly downloads, cross-tab sync built-in |
| dexie-react-hooks | 1.x | React integration | useLiveQuery() for reactive queries, automatic re-renders on data changes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | - | Dexie provides everything needed for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dexie | idb | idb is smaller (11M weekly downloads) but lacks React hooks, bulk operations, and schema migrations - would require more manual work |
| dexie | localforage | localforage is simpler but doesn't support indexes, complex queries, or reactive updates |
| dexie | RxDB | RxDB is more powerful but overkill for caching - adds complexity for sync features not needed here |

**Installation:**
```bash
npm install dexie dexie-react-hooks
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── cache/
│       ├── db.ts              # Dexie database definition and schema
│       ├── messages.ts        # Message cache operations (store, get, cleanup)
│       ├── use-cached-messages.ts  # React hook for cached messages
│       └── index.ts           # Public exports
├── components/
│   └── message/
│       └── message-list.tsx   # Updated to use cached messages when offline
```

### Pattern 1: Dexie Database Definition with TypeScript
**What:** Define IndexedDB schema with proper TypeScript types
**When to use:** Always - this is the foundation
**Example:**
```typescript
// src/lib/cache/db.ts
// Source: https://dexie.org/docs/Typescript
import Dexie, { type EntityTable } from "dexie";

// Match the existing Message interface from socket-events.ts
export interface CachedMessage {
  id: string;               // Primary key (message UUID)
  content: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  channelId: string | null;
  conversationId: string | null;
  parentId: string | null;
  replyCount: number;
  sequence: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cachedAt: Date;           // For TTL cleanup
}

const db = new Dexie("OCommsCache") as Dexie & {
  messages: EntityTable<CachedMessage, "id">;
};

db.version(1).stores({
  // Index: primary key, channelId+sequence (for ordering), conversationId+sequence, cachedAt (for cleanup)
  messages: "id, [channelId+sequence], [conversationId+sequence], cachedAt",
});

export { db };
```

### Pattern 2: Cache Messages on Socket Events
**What:** Intercept socket events to populate cache alongside state
**When to use:** When receiving new messages in real-time
**Example:**
```typescript
// In message-list.tsx or a dedicated hook
// Source: https://dexie.org/docs/Table/Table.bulkPut()
import { db } from "@/lib/cache/db";

function handleNewMessage(message: Message) {
  // Existing state update
  setMessages((prev) => [...prev, message]);

  // Cache the message
  db.messages.put({
    ...message,
    authorName: message.author?.name ?? null,
    authorEmail: message.author?.email ?? "",
    cachedAt: new Date(),
  }).catch((err) => {
    console.error("[Cache] Failed to cache message:", err);
  });
}
```

### Pattern 3: Bulk Cache on Page Load
**What:** Cache initial messages when loading a channel/DM
**When to use:** When server-rendered messages arrive
**Example:**
```typescript
// Source: https://dexie.org/docs/Table/Table.bulkPut()
import { db } from "@/lib/cache/db";
import type { Message } from "@/lib/socket-events";

export async function cacheMessages(messages: Message[]): Promise<void> {
  const now = new Date();
  const cached = messages.map((m) => ({
    id: m.id,
    content: m.content,
    authorId: m.authorId,
    authorName: m.author?.name ?? null,
    authorEmail: m.author?.email ?? "",
    channelId: m.channelId ?? null,
    conversationId: m.conversationId ?? null,
    parentId: m.parentId ?? null,
    replyCount: m.replyCount ?? 0,
    sequence: m.sequence,
    deletedAt: m.deletedAt ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    cachedAt: now,
  }));

  // bulkPut is fast - 10K records in 2-3 seconds
  await db.messages.bulkPut(cached);
}
```

### Pattern 4: TTL Cleanup (7-Day Retention)
**What:** Delete messages older than 7 days from cache
**When to use:** On app initialization, before displaying cached data
**Example:**
```typescript
// Source: https://dexie.org/docs/Collection/Collection.delete()
import { db } from "@/lib/cache/db";

export async function cleanupExpiredMessages(): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Delete all messages where cachedAt is before 7 days ago
  const count = await db.messages
    .where("cachedAt")
    .below(sevenDaysAgo)
    .delete();

  console.log(`[Cache] Cleaned up ${count} expired messages`);
  return count;
}
```

### Pattern 5: Read Cached Messages When Offline
**What:** Use Dexie's useLiveQuery for reactive offline data
**When to use:** When user is offline but needs to view messages
**Example:**
```typescript
// Source: https://dexie.org/docs/dexie-react-hooks/useLiveQuery()
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/cache/db";

export function useCachedMessages(channelId: string | null, conversationId: string | null) {
  return useLiveQuery(
    async () => {
      if (channelId) {
        return db.messages
          .where("[channelId+sequence]")
          .between([channelId, Dexie.minKey], [channelId, Dexie.maxKey])
          .toArray();
      }
      if (conversationId) {
        return db.messages
          .where("[conversationId+sequence]")
          .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
          .toArray();
      }
      return [];
    },
    [channelId, conversationId],
    [] // default value while loading
  );
}
```

### Pattern 6: Hybrid Online/Offline Strategy
**What:** Use server data when online, cached data when offline
**When to use:** In message display components
**Example:**
```typescript
// In ChannelContent or MessageList
import { useOnlineStatus } from "@/lib/pwa/use-online-status";
import { useCachedMessages } from "@/lib/cache/use-cached-messages";

function MessageListWithOffline({ channelId, initialMessages, ...props }) {
  const isOnline = useOnlineStatus();
  const cachedMessages = useCachedMessages(channelId, null);

  // When online: use initialMessages + real-time updates (existing behavior)
  // When offline: fall back to cached messages
  const displayMessages = isOnline
    ? initialMessages  // managed by existing socket logic
    : cachedMessages;

  return <MessageList messages={displayMessages} {...props} />;
}
```

### Anti-Patterns to Avoid
- **Caching entire database:** Only cache messages for channels the user has visited - don't proactively sync all channels
- **Using localStorage for messages:** localStorage has 5MB limit and no query capabilities - IndexedDB can store much more
- **Ignoring deletedAt:** When caching, still store soft-deleted messages (with deletedAt set) so the UI shows "[message deleted]" consistently
- **Not handling Dexie errors:** IndexedDB can fail (quota exceeded, browser private mode) - always catch errors
- **Syncing back to server from cache:** This phase is read-only caching - sending cached messages is a different feature (Background Sync)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB abstraction | Raw IDBDatabase API | Dexie.js | Raw API is callback-based, error-prone, verbose |
| React reactivity | Manual subscriptions | useLiveQuery() | Dexie handles cross-tab sync, re-render optimization |
| Bulk inserts | Loop with put() | bulkPut() | 5-10x faster, doesn't wait for each onsuccess |
| Compound indexes | Multiple queries | Dexie compound index | `[channelId+sequence]` enables efficient range queries |
| Schema migrations | Manual version detection | Dexie.version().upgrade() | Built-in version tracking and data migrations |

**Key insight:** IndexedDB's raw API is notoriously complex (transactions, cursors, events). Dexie abstracts this into a promise-based API that feels like working with a modern database. Don't fight the raw API.

## Common Pitfalls

### Pitfall 1: Forgetting to Index cachedAt for TTL Queries
**What goes wrong:** TTL cleanup becomes slow (full table scan)
**Why it happens:** Developers forget to add cachedAt to the schema indexes
**How to avoid:** Include `cachedAt` in the Dexie stores() definition
**Warning signs:** Cleanup takes seconds instead of milliseconds on 1000+ messages

### Pitfall 2: Not Handling Private Browsing Mode
**What goes wrong:** IndexedDB operations fail silently or throw
**Why it happens:** Safari/Firefox private mode has limited or no IndexedDB support
**How to avoid:** Wrap all Dexie operations in try/catch, degrade gracefully
**Warning signs:** Users in incognito report broken offline mode

### Pitfall 3: Safari's 7-Day Inactivity Deletion
**What goes wrong:** Users lose cached data after not using PWA for 7 days
**Why it happens:** Safari's ITP deletes all script-writable storage after 7 days of non-use
**How to avoid:** Accept as limitation, don't promise permanent offline storage on iOS
**Warning signs:** iOS users report "lost" messages after vacation

### Pitfall 4: Not Updating cachedAt on Re-cache
**What goes wrong:** Messages get cleaned up even though user recently viewed them
**Why it happens:** Using original createdAt instead of re-caching with new timestamp
**How to avoid:** Always set cachedAt to now when caching/re-caching
**Warning signs:** User views channel, comes back 6 days later, messages gone

### Pitfall 5: Blocking UI with Large bulkPut Operations
**What goes wrong:** UI freezes when caching many messages
**Why it happens:** Large IndexedDB writes can be slow
**How to avoid:** Don't await bulk operations in render path - fire and forget, or use web worker
**Warning signs:** Visible lag when opening channel with 100+ messages

### Pitfall 6: Cache Inconsistency with Soft Deletes
**What goes wrong:** Deleted messages reappear when offline
**Why it happens:** Cache doesn't get updated when message:deleted event fires
**How to avoid:** Listen to message:deleted and update cache (set deletedAt)
**Warning signs:** Messages user deleted while online reappear offline

## Code Examples

Verified patterns from official sources:

### Complete Database Setup
```typescript
// src/lib/cache/db.ts
// Source: https://dexie.org/docs/Typescript
import Dexie, { type EntityTable } from "dexie";

export interface CachedMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  channelId: string | null;
  conversationId: string | null;
  parentId: string | null;
  replyCount: number;
  sequence: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cachedAt: Date;
}

const db = new Dexie("OCommsCache") as Dexie & {
  messages: EntityTable<CachedMessage, "id">;
};

// Version 1: Initial schema
db.version(1).stores({
  messages: "id, [channelId+sequence], [conversationId+sequence], cachedAt",
});

export { db };
export type { CachedMessage };
```

### Cache Operations Module
```typescript
// src/lib/cache/messages.ts
// Source: https://dexie.org/docs/Table/Table.bulkPut()
// Source: https://dexie.org/docs/Collection/Collection.delete()
import Dexie from "dexie";
import { db, type CachedMessage } from "./db";
import type { Message } from "@/lib/socket-events";

const RETENTION_DAYS = 7;

function messageToCache(message: Message): CachedMessage {
  return {
    id: message.id,
    content: message.content,
    authorId: message.authorId,
    authorName: message.author?.name ?? null,
    authorEmail: message.author?.email ?? "",
    channelId: message.channelId ?? null,
    conversationId: message.conversationId ?? null,
    parentId: message.parentId ?? null,
    replyCount: message.replyCount ?? 0,
    sequence: message.sequence,
    deletedAt: message.deletedAt ?? null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    cachedAt: new Date(),
  };
}

export async function cacheMessage(message: Message): Promise<void> {
  try {
    await db.messages.put(messageToCache(message));
  } catch (err) {
    console.error("[Cache] Failed to cache message:", err);
  }
}

export async function cacheMessages(messages: Message[]): Promise<void> {
  try {
    const cached = messages.map(messageToCache);
    await db.messages.bulkPut(cached);
  } catch (err) {
    console.error("[Cache] Failed to bulk cache messages:", err);
  }
}

export async function updateMessageDeletion(
  messageId: string,
  deletedAt: Date
): Promise<void> {
  try {
    await db.messages.update(messageId, { deletedAt, cachedAt: new Date() });
  } catch (err) {
    console.error("[Cache] Failed to update message deletion:", err);
  }
}

export async function getCachedChannelMessages(
  channelId: string
): Promise<CachedMessage[]> {
  return db.messages
    .where("[channelId+sequence]")
    .between([channelId, Dexie.minKey], [channelId, Dexie.maxKey])
    .toArray();
}

export async function getCachedConversationMessages(
  conversationId: string
): Promise<CachedMessage[]> {
  return db.messages
    .where("[conversationId+sequence]")
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .toArray();
}

export async function cleanupExpiredMessages(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const count = await db.messages
    .where("cachedAt")
    .below(cutoff)
    .delete();

  if (count > 0) {
    console.log(`[Cache] Cleaned up ${count} expired messages`);
  }
  return count;
}

export async function clearAllCache(): Promise<void> {
  await db.messages.clear();
  console.log("[Cache] Cleared all cached messages");
}
```

### React Hook for Cached Messages
```typescript
// src/lib/cache/use-cached-messages.ts
// Source: https://dexie.org/docs/dexie-react-hooks/useLiveQuery()
import { useLiveQuery } from "dexie-react-hooks";
import Dexie from "dexie";
import { db, type CachedMessage } from "./db";

export function useCachedChannelMessages(
  channelId: string | null
): CachedMessage[] {
  const messages = useLiveQuery(
    async () => {
      if (!channelId) return [];
      return db.messages
        .where("[channelId+sequence]")
        .between([channelId, Dexie.minKey], [channelId, Dexie.maxKey])
        .toArray();
    },
    [channelId],
    []
  );
  return messages;
}

export function useCachedConversationMessages(
  conversationId: string | null
): CachedMessage[] {
  const messages = useLiveQuery(
    async () => {
      if (!conversationId) return [];
      return db.messages
        .where("[conversationId+sequence]")
        .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
        .toArray();
    },
    [conversationId],
    []
  );
  return messages;
}
```

### Initialize Cache on App Load
```typescript
// src/lib/cache/init.ts
import { cleanupExpiredMessages } from "./messages";

let initialized = false;

export async function initializeCache(): Promise<void> {
  if (initialized) return;
  if (typeof window === "undefined") return;

  try {
    await cleanupExpiredMessages();
    initialized = true;
    console.log("[Cache] Initialized");
  } catch (err) {
    console.error("[Cache] Failed to initialize:", err);
    // Continue without cache - graceful degradation
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw IndexedDB API | Dexie.js wrapper | 2015+ | Dramatic DX improvement, fewer bugs |
| Manual React subscriptions | useLiveQuery() | Dexie 3.0+ (2020) | Automatic reactivity, cross-tab sync |
| Schema in version(1) only | Declarative schema updates | Dexie 3.0+ | Easier migrations, less boilerplate |
| Custom cross-tab messaging | Built-in storagemutated event | Dexie 3.2+ | Zero-config cross-tab sync |

**Deprecated/outdated:**
- Using `localStorage` for structured data - IndexedDB is the right choice
- Manual `IDBTransaction` management - Dexie handles this
- `indexedDB.open()` with version callbacks - Dexie's version() is cleaner

## Open Questions

Things that couldn't be fully resolved:

1. **Thread replies caching scope**
   - What we know: Main messages should be cached; thread replies are loaded on-demand
   - What's unclear: Should thread replies also be cached when viewed?
   - Recommendation: Start with main messages only; add thread caching if users request offline thread reading

2. **Reactions and pins caching**
   - What we know: Phase scope is OFFL-01 (messages) and OFFL-02 (read offline)
   - What's unclear: Whether reactions/pins should also be cached for complete offline experience
   - Recommendation: Defer to future phase - keep this phase focused on message content

3. **Cache size limits**
   - What we know: IndexedDB quotas are generous (50MB+), but Safari/iOS can be aggressive
   - What's unclear: Exact behavior when quota is exceeded
   - Recommendation: Implement error handling for QuotaExceededError, clear oldest messages if needed

4. **Service worker integration**
   - What we know: Dexie can be used from service workers (same API)
   - What's unclear: Whether SW should also cache messages (Background Sync use case)
   - Recommendation: Keep caching in main thread for Phase 16; SW integration is for future offline-send feature

## Sources

### Primary (HIGH confidence)
- [Dexie.js Official Documentation](https://dexie.org/) - Current version 4.0
- [dexie-react-hooks useLiveQuery](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()) - React integration guide
- [Dexie TypeScript Guide](https://dexie.org/docs/Typescript) - Type-safe schema definition
- [Table.bulkPut()](https://dexie.org/docs/Table/Table.bulkPut()) - Bulk operations
- [Collection.delete()](https://dexie.org/docs/Collection/Collection.delete()) - TTL cleanup pattern

### Secondary (MEDIUM confidence)
- [npm-compare dexie vs idb](https://npm-compare.com/dexie,idb) - Library comparison
- [LogRocket: Offline-first frontend apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - Architecture patterns
- [web.dev PWA offline data](https://web.dev/learn/pwa/offline-data) - Best practices

### Tertiary (LOW confidence)
- Stack Overflow discussions on Safari IndexedDB limitations
- GitHub issues on Dexie quota handling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Dexie is clearly the dominant React-friendly IndexedDB library
- Architecture: HIGH - Patterns verified against official Dexie documentation
- Pitfalls: MEDIUM - Safari limitations confirmed by multiple sources, but exact behavior varies by version

**Research date:** 2026-01-19
**Valid until:** 60 days (IndexedDB APIs are stable, Dexie version may update)

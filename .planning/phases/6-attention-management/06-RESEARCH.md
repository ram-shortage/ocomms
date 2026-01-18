# Phase 6: Attention Management - Research

**Researched:** 2026-01-18
**Domain:** Unread counts, read state management, per-channel tracking
**Confidence:** HIGH

## Summary

This research covers the attention management system for OComms: tracking unread message counts per channel/conversation, allowing users to mark channels as read, and supporting the "mark as unread" feature for individual messages. The project already has a robust WebSocket infrastructure with Socket.IO, Redis pub/sub for scaling, PostgreSQL with Drizzle ORM, and a notification system that delivers to user-specific rooms.

Key findings:
- **Read state tracking** uses a per-user-per-channel table storing the `lastReadSequence` (message sequence number) rather than individual message flags
- **Unread counts** are computed as `MAX(message.sequence) - lastReadSequence` per channel, cached in Redis for performance
- **Mark as unread** stores a `markedUnreadAtSequence` field, making that message and all newer messages appear unread
- **Real-time updates** push unread count changes via existing `user:{userId}` socket rooms

**Primary recommendation:** Use a `channel_read_state` table with `lastReadSequence` per user-channel pair. Cache unread counts in Redis with key `unread:{userId}:{channelId}`. Invalidate cache on message receipt and read state updates. Deliver real-time unread updates via WebSocket to user rooms.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.40.x | Database ORM | Already in use, SQL-first, TypeScript-native |
| ioredis | 5.x | Redis/Valkey client | Already in use for pub/sub and presence |
| socket.io | 4.8.x | WebSocket server | Already in use for real-time messaging |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | 5.x | Client state | Already in use for client-side state management |
| @tanstack/react-query | 5.x | Server state | Already in use for data fetching/caching |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-channel read state | Per-message read flag | Message-level flags don't scale (N messages x M users = explosion) |
| Redis counter cache | PostgreSQL-only | Redis gives sub-millisecond counts; PostgreSQL requires aggregate queries |
| Sequence-based tracking | Timestamp-based | Sequences are monotonic and avoid clock skew; already in message schema |

**Installation:**

No new dependencies required. Uses existing stack.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── db/
│   └── schema/
│       └── channel-read-state.ts    # New table: per-user-per-channel read state
├── server/
│   └── socket/
│       └── handlers/
│           └── unread.ts            # Socket handlers for read state
├── lib/
│   ├── actions/
│   │   └── unread.ts                # Server actions for read state
│   └── unread.ts                    # Client-side unread utilities
└── components/
    ├── channel/
    │   └── channel-list.tsx         # Update: show unread badges
    └── message/
        └── message-item.tsx         # Update: mark as unread context menu
```

### Pattern 1: Channel Read State Table

**What:** Per-user-per-channel record of read position
**When to use:** All unread tracking

```typescript
// src/db/schema/channel-read-state.ts
import { pgTable, uuid, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { channels } from "./channel";
import { conversations } from "./conversation";

/**
 * Tracks read position per user per channel/conversation.
 *
 * Pattern: Store lastReadSequence (the sequence number of the last read message).
 * Unread count = MAX(message.sequence) - lastReadSequence
 *
 * For "mark as unread": store markedUnreadAtSequence to override lastReadSequence.
 */
export const channelReadState = pgTable("channel_read_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Either channel or conversation, not both
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),

  // The sequence number of the last message the user has read
  lastReadSequence: integer("last_read_sequence").notNull().default(0),

  // If user marks a message as unread, this stores that message's sequence
  // When set, effective read position = MIN(lastReadSequence, markedUnreadAtSequence - 1)
  markedUnreadAtSequence: integer("marked_unread_at_sequence"),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Unique: one read state per user per channel
  uniqueIndex("channel_read_state_user_channel_idx")
    .on(table.userId, table.channelId)
    .where(sql`${table.channelId} IS NOT NULL`),
  // Unique: one read state per user per conversation
  uniqueIndex("channel_read_state_user_conv_idx")
    .on(table.userId, table.conversationId)
    .where(sql`${table.conversationId} IS NOT NULL`),
  // Index for fetching all user's read states
  index("channel_read_state_user_idx").on(table.userId),
]);
```

### Pattern 2: Unread Count Computation

**What:** Calculate unread count from read state
**When to use:** Displaying channel list with badges

```typescript
// Unread count calculation
// For a channel, unread = maxSequence - effectiveReadSequence

async function getUnreadCount(
  userId: string,
  channelId: string
): Promise<number> {
  // 1. Get max sequence in channel
  const [maxSeq] = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(${messages.sequence}), 0)` })
    .from(messages)
    .where(and(
      eq(messages.channelId, channelId),
      isNull(messages.deletedAt)
    ));

  // 2. Get user's read state
  const readState = await db.query.channelReadState.findFirst({
    where: and(
      eq(channelReadState.userId, userId),
      eq(channelReadState.channelId, channelId)
    ),
  });

  // 3. Calculate effective read position
  let effectiveReadSeq = readState?.lastReadSequence ?? 0;
  if (readState?.markedUnreadAtSequence) {
    // User marked a message as unread, so treat everything from that point as unread
    effectiveReadSeq = Math.min(effectiveReadSeq, readState.markedUnreadAtSequence - 1);
  }

  // 4. Unread = messages after effective read position
  return Math.max(0, (maxSeq.maxSeq ?? 0) - effectiveReadSeq);
}
```

### Pattern 3: Redis Cache for Unread Counts

**What:** Cache unread counts in Redis for performance
**When to use:** Sidebar rendering, frequent access

```typescript
// src/server/socket/handlers/unread.ts

const UNREAD_CACHE_TTL = 60; // seconds

// Redis key patterns
const getUnreadKey = (userId: string, channelId: string) =>
  `unread:${userId}:channel:${channelId}`;

const getConvUnreadKey = (userId: string, conversationId: string) =>
  `unread:${userId}:conv:${conversationId}`;

// Get cached unread count or compute and cache
async function getCachedUnreadCount(
  redis: Redis,
  userId: string,
  channelId: string
): Promise<number> {
  const key = getUnreadKey(userId, channelId);

  // Try cache first
  const cached = await redis.get(key);
  if (cached !== null) {
    return parseInt(cached, 10);
  }

  // Compute from database
  const count = await getUnreadCount(userId, channelId);

  // Cache with TTL
  await redis.setex(key, UNREAD_CACHE_TTL, count.toString());

  return count;
}

// Invalidate cache when state changes
async function invalidateUnreadCache(
  redis: Redis,
  userId: string,
  channelId?: string,
  conversationId?: string
): void {
  if (channelId) {
    await redis.del(getUnreadKey(userId, channelId));
  }
  if (conversationId) {
    await redis.del(getConvUnreadKey(userId, conversationId));
  }
}
```

### Pattern 4: Mark Channel as Read

**What:** Update read state when user views channel
**When to use:** On channel navigation, explicit "mark as read" action

```typescript
// Mark all messages in channel as read
async function markChannelAsRead(
  userId: string,
  channelId: string
): Promise<void> {
  // Get current max sequence
  const [maxSeq] = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(${messages.sequence}), 0)` })
    .from(messages)
    .where(and(
      eq(messages.channelId, channelId),
      isNull(messages.deletedAt)
    ));

  // Upsert read state, clear any "marked as unread"
  await db
    .insert(channelReadState)
    .values({
      userId,
      channelId,
      lastReadSequence: maxSeq.maxSeq ?? 0,
      markedUnreadAtSequence: null, // Clear manual unread marker
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [channelReadState.userId, channelReadState.channelId],
      set: {
        lastReadSequence: maxSeq.maxSeq ?? 0,
        markedUnreadAtSequence: null,
        updatedAt: new Date(),
      },
    });

  // Invalidate Redis cache
  await invalidateUnreadCache(redis, userId, channelId);
}
```

### Pattern 5: Mark Message as Unread

**What:** Set a message as the new "start of unread"
**When to use:** User context menu action on a message

```typescript
// Mark from a specific message as unread
async function markMessageAsUnread(
  userId: string,
  messageId: string
): Promise<void> {
  // Get the message to find its sequence
  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
    columns: { sequence: true, channelId: true, conversationId: true },
  });

  if (!message) throw new Error("Message not found");

  const { channelId, conversationId, sequence } = message;

  // Update read state with markedUnreadAtSequence
  await db
    .insert(channelReadState)
    .values({
      userId,
      channelId: channelId ?? undefined,
      conversationId: conversationId ?? undefined,
      lastReadSequence: 0, // Will be overwritten by conflict
      markedUnreadAtSequence: sequence,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: channelId
        ? [channelReadState.userId, channelReadState.channelId]
        : [channelReadState.userId, channelReadState.conversationId],
      set: {
        markedUnreadAtSequence: sequence,
        updatedAt: new Date(),
      },
    });

  // Invalidate cache
  await invalidateUnreadCache(redis, userId, channelId ?? undefined, conversationId ?? undefined);
}
```

### Pattern 6: Real-Time Unread Updates

**What:** Push unread count changes via WebSocket
**When to use:** New message arrives, user marks as read

```typescript
// Socket event types to add to socket-events.ts
interface ServerToClientEvents {
  // ... existing events ...
  "unread:update": (data: {
    channelId?: string;
    conversationId?: string;
    unreadCount: number;
  }) => void;
}

interface ClientToServerEvents {
  // ... existing events ...
  "unread:markRead": (
    data: { channelId?: string; conversationId?: string },
    callback: (response: { success: boolean }) => void
  ) => void;
  "unread:markMessageUnread": (
    data: { messageId: string },
    callback: (response: { success: boolean }) => void
  ) => void;
  "unread:fetch": (
    data: { channelIds?: string[]; conversationIds?: string[] },
    callback: (response: {
      channels: Record<string, number>;
      conversations: Record<string, number>;
    }) => void
  ) => void;
}
```

### Anti-Patterns to Avoid

- **Per-message read flag:** Storing `read: boolean` on each message for each user creates N*M records and doesn't scale
- **Polling for unread counts:** Use WebSocket push, not polling intervals
- **Computing counts on every render:** Cache in Redis, push updates reactively
- **Ignoring sequence numbers:** Use existing `sequence` field for ordering, not timestamps
- **Separate tables for channels/DMs:** One `channelReadState` table handles both with optional FK

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache invalidation | Custom pub/sub | Redis DEL + Socket.IO emit | Socket.IO already broadcasts; Redis handles cache |
| Unread badge animation | Custom CSS transitions | Tailwind animate-pulse | Consistent with existing UI, tested |
| Sequence number generation | Application logic | Existing message.sequence | Already implemented in Phase 3 |
| Multi-device sync | Custom sync protocol | User socket rooms | user:{userId} rooms already handle this |

**Key insight:** The existing WebSocket infrastructure with user rooms and Redis caching handles 90% of the real-time complexity. Focus on the data model and state transitions.

## Common Pitfalls

### Pitfall 1: N+1 Query for Sidebar Unread Counts

**What goes wrong:** Fetching unread count for each channel in a loop
**Why it happens:** Naive implementation fetches per-channel
**How to avoid:**
- Batch fetch all read states for user in one query
- Use Redis MGET for cached counts
- Precompute during initial load
**Warning signs:** Sidebar load time increases with channel count

### Pitfall 2: Race Condition on Mark as Read

**What goes wrong:** New message arrives while marking as read, causing wrong count
**Why it happens:** Message insert and read state update happen concurrently
**How to avoid:**
- Use sequence numbers, not "mark all current"
- Atomic update: `SET lastReadSequence = MAX(current, newValue)`
- Recompute count after both operations complete
**Warning signs:** Intermittent unread count off by 1

### Pitfall 3: Stale Cache After Mark as Unread

**What goes wrong:** Unread count shows 0 after marking as unread
**Why it happens:** Cache not invalidated, or wrong key pattern
**How to avoid:**
- Always invalidate after any read state change
- Use consistent key patterns
- Set short TTL (60s) as safety net
**Warning signs:** Must refresh page to see correct count

### Pitfall 4: Missing Unread Update on New Message

**What goes wrong:** New message arrives but unread badge doesn't update
**Why it happens:** Only sender's client publishes, recipient not notified of count change
**How to avoid:**
- In message handler, after broadcast, compute and emit unread:update to all channel members
- Filter out sender from unread update recipients
**Warning signs:** Have to navigate away and back to see new unread

### Pitfall 5: Mark as Unread Doesn't Persist Across Devices

**What goes wrong:** User marks unread on phone, laptop shows as read
**Why it happens:** Only updating local state, not pushing to server
**How to avoid:**
- All read state changes go through server
- Emit update to user:{userId} room (all devices)
- Client listens for unread:update and syncs local state
**Warning signs:** Multi-device testing shows inconsistency

### Pitfall 6: Conversation Participant Changes Break Counts

**What goes wrong:** User joins channel mid-conversation, sees huge unread count
**Why it happens:** No read state exists, defaults to 0, all messages appear unread
**How to avoid:**
- On channel join, create read state with current max sequence
- New members start "caught up", not "all unread"
**Warning signs:** New channel members report thousands of unreads

## Code Examples

Verified patterns from official sources and existing codebase:

### Schema Migration

```typescript
// src/db/schema/channel-read-state.ts
import { pgTable, uuid, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./auth";
import { channels } from "./channel";
import { conversations } from "./conversation";

export const channelReadState = pgTable("channel_read_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),
  lastReadSequence: integer("last_read_sequence").notNull().default(0),
  markedUnreadAtSequence: integer("marked_unread_at_sequence"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("channel_read_state_user_channel_idx")
    .on(table.userId, table.channelId)
    .where(sql`channel_id IS NOT NULL`),
  uniqueIndex("channel_read_state_user_conv_idx")
    .on(table.userId, table.conversationId)
    .where(sql`conversation_id IS NOT NULL`),
  index("channel_read_state_user_idx").on(table.userId),
]);

export const channelReadStateRelations = relations(channelReadState, ({ one }) => ({
  user: one(users, {
    fields: [channelReadState.userId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [channelReadState.channelId],
    references: [channels.id],
  }),
  conversation: one(conversations, {
    fields: [channelReadState.conversationId],
    references: [conversations.id],
  }),
}));
```

### Socket Handler for Unread Operations

```typescript
// src/server/socket/handlers/unread.ts
import type { Server, Socket } from "socket.io";
import { db } from "@/db";
import { channelReadState, messages, channelMembers, conversationParticipants } from "@/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { getRoomName } from "../rooms";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";
import type { Redis } from "ioredis";

type SocketIOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const UNREAD_CACHE_TTL = 60;

export function setupUnreadHandlers(io: SocketIOServer, redis: Redis) {
  return {
    /**
     * Compute unread count for a channel
     */
    async getUnreadCount(userId: string, channelId: string): Promise<number> {
      // Try Redis cache first
      const cacheKey = `unread:${userId}:channel:${channelId}`;
      const cached = await redis.get(cacheKey);
      if (cached !== null) return parseInt(cached, 10);

      // Compute from DB
      const [maxSeqResult] = await db
        .select({ maxSeq: sql<number>`COALESCE(MAX(${messages.sequence}), 0)` })
        .from(messages)
        .where(and(
          eq(messages.channelId, channelId),
          isNull(messages.deletedAt)
        ));

      const readState = await db.query.channelReadState.findFirst({
        where: and(
          eq(channelReadState.userId, userId),
          eq(channelReadState.channelId, channelId)
        ),
      });

      let effectiveReadSeq = readState?.lastReadSequence ?? 0;
      if (readState?.markedUnreadAtSequence !== null && readState?.markedUnreadAtSequence !== undefined) {
        effectiveReadSeq = Math.min(effectiveReadSeq, readState.markedUnreadAtSequence - 1);
      }

      const unread = Math.max(0, (maxSeqResult.maxSeq ?? 0) - effectiveReadSeq);

      // Cache result
      await redis.setex(cacheKey, UNREAD_CACHE_TTL, unread.toString());

      return unread;
    },

    /**
     * Mark channel as read (all messages up to current max)
     */
    async markChannelAsRead(userId: string, channelId: string): Promise<void> {
      const [maxSeqResult] = await db
        .select({ maxSeq: sql<number>`COALESCE(MAX(${messages.sequence}), 0)` })
        .from(messages)
        .where(and(
          eq(messages.channelId, channelId),
          isNull(messages.deletedAt)
        ));

      await db
        .insert(channelReadState)
        .values({
          userId,
          channelId,
          lastReadSequence: maxSeqResult.maxSeq ?? 0,
          markedUnreadAtSequence: null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [channelReadState.userId, channelReadState.channelId],
          set: {
            lastReadSequence: maxSeqResult.maxSeq ?? 0,
            markedUnreadAtSequence: null,
            updatedAt: new Date(),
          },
        });

      // Invalidate cache
      await redis.del(`unread:${userId}:channel:${channelId}`);

      // Emit update to user's devices
      io.to(getRoomName.user(userId)).emit("unread:update", {
        channelId,
        unreadCount: 0,
      });
    },

    /**
     * Mark a specific message as unread (and all after it)
     */
    async markMessageAsUnread(userId: string, messageId: string): Promise<void> {
      const message = await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
        columns: { sequence: true, channelId: true, conversationId: true },
      });

      if (!message) throw new Error("Message not found");

      const { channelId, conversationId, sequence } = message;

      if (channelId) {
        await db
          .insert(channelReadState)
          .values({
            userId,
            channelId,
            lastReadSequence: 0,
            markedUnreadAtSequence: sequence,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [channelReadState.userId, channelReadState.channelId],
            set: {
              markedUnreadAtSequence: sequence,
              updatedAt: new Date(),
            },
          });

        await redis.del(`unread:${userId}:channel:${channelId}`);

        const newCount = await this.getUnreadCount(userId, channelId);
        io.to(getRoomName.user(userId)).emit("unread:update", {
          channelId,
          unreadCount: newCount,
        });
      }

      // Similar for conversationId...
    },

    /**
     * Notify channel members of new unread (called after message:new)
     */
    async notifyUnreadIncrement(
      channelId: string,
      senderId: string,
      newSequence: number
    ): Promise<void> {
      // Get all channel members except sender
      const members = await db
        .select({ userId: channelMembers.userId })
        .from(channelMembers)
        .where(eq(channelMembers.channelId, channelId));

      for (const member of members) {
        if (member.userId === senderId) continue;

        // Invalidate cache for this member
        await redis.del(`unread:${member.userId}:channel:${channelId}`);

        // Get new count and emit
        const count = await this.getUnreadCount(member.userId, channelId);
        io.to(getRoomName.user(member.userId)).emit("unread:update", {
          channelId,
          unreadCount: count,
        });
      }
    },
  };
}

/**
 * Register socket event handlers for unread management
 */
export function handleUnreadEvents(
  socket: SocketWithData,
  io: SocketIOServer,
  unreadManager: ReturnType<typeof setupUnreadHandlers>
): void {
  const userId = socket.data.userId;

  // Fetch unread counts for multiple channels
  socket.on("unread:fetch", async (data, callback) => {
    try {
      const channels: Record<string, number> = {};
      const conversations: Record<string, number> = {};

      if (data.channelIds) {
        for (const channelId of data.channelIds) {
          channels[channelId] = await unreadManager.getUnreadCount(userId, channelId);
        }
      }

      // Similar for conversationIds...

      callback({ channels, conversations });
    } catch (error) {
      console.error("[Unread] Error fetching counts:", error);
      callback({ channels: {}, conversations: {} });
    }
  });

  // Mark channel as read
  socket.on("unread:markRead", async (data, callback) => {
    try {
      if (data.channelId) {
        await unreadManager.markChannelAsRead(userId, data.channelId);
      }
      // Similar for conversationId...
      callback({ success: true });
    } catch (error) {
      console.error("[Unread] Error marking as read:", error);
      callback({ success: false });
    }
  });

  // Mark message as unread
  socket.on("unread:markMessageUnread", async (data, callback) => {
    try {
      await unreadManager.markMessageAsUnread(userId, data.messageId);
      callback({ success: true });
    } catch (error) {
      console.error("[Unread] Error marking as unread:", error);
      callback({ success: false });
    }
  });
}
```

### Client-Side Channel List with Unread Badges

```typescript
// src/components/channel/channel-list-client.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Hash, Lock } from "lucide-react";
import { useSocket } from "@/lib/socket-client";

interface Channel {
  id: string;
  name: string;
  slug: string;
  isPrivate: boolean;
}

interface ChannelListClientProps {
  channels: Channel[];
  workspaceSlug: string;
}

export function ChannelListClient({ channels, workspaceSlug }: ChannelListClientProps) {
  const socket = useSocket();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Fetch initial unread counts
  useEffect(() => {
    if (!socket) return;

    const channelIds = channels.map(c => c.id);
    socket.emit("unread:fetch", { channelIds }, (response) => {
      setUnreadCounts(response.channels);
    });
  }, [socket, channels]);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleUnreadUpdate = (data: { channelId?: string; unreadCount: number }) => {
      if (data.channelId) {
        setUnreadCounts(prev => ({
          ...prev,
          [data.channelId!]: data.unreadCount,
        }));
      }
    };

    socket.on("unread:update", handleUnreadUpdate);

    return () => {
      socket.off("unread:update", handleUnreadUpdate);
    };
  }, [socket]);

  return (
    <nav className="space-y-1">
      {channels.map((channel) => {
        const unread = unreadCounts[channel.id] ?? 0;

        return (
          <Link
            key={channel.id}
            href={`/${workspaceSlug}/channels/${channel.slug}`}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
          >
            {channel.isPrivate ? (
              <Lock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Hash className="h-4 w-4 text-muted-foreground" />
            )}
            <span className={`truncate ${unread > 0 ? "font-semibold" : ""}`}>
              {channel.name}
            </span>
            {unread > 0 && (
              <span className="ml-auto bg-blue-600 text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-message read boolean | Per-channel sequence tracking | N/A (design choice) | Scales to millions of messages |
| Polling for unread counts | WebSocket push | N/A (design choice) | Real-time updates, no polling overhead |
| Timestamp-based tracking | Sequence-based tracking | Phase 3 decision | Avoids clock skew, monotonic ordering |
| Redis-only counts | Redis cache + PostgreSQL source of truth | N/A (pattern) | Durability + performance |

**Deprecated/outdated:**
- **Per-message read tracking:** Only appropriate for small-scale 1:1 chat, not channels
- **Client timestamp for read state:** Use server-assigned sequences

## Open Questions

Things that couldn't be fully resolved:

1. **Automatic mark-as-read timing**
   - What we know: Should mark as read when user views channel
   - What's unclear: Mark immediately on navigation, or after visible for N seconds?
   - Recommendation: Mark immediately on navigation, re-mark on scroll to bottom

2. **Unread divider placement**
   - What we know: Slack shows "X new messages" divider
   - What's unclear: Where to place divider if user marked as unread
   - Recommendation: Show divider above first unread message based on effective read sequence

3. **Thread unread tracking**
   - What we know: Threads have separate message sequences
   - What's unclear: Track thread unreads separately or as part of channel?
   - Recommendation: For v1, focus on channel-level only; thread tracking is Phase 4 territory

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns (messages.sequence, Socket.IO rooms, Redis)
- [Slack Architecture - System Design](https://systemdesign.one/slack-architecture/) - Read state patterns
- [Read Receipts for Chat Apps](https://ably.com/topic/read-receipts) - Channel architecture

### Secondary (MEDIUM confidence)
- [Sendbird Mark as Unread](https://docs.sendbird.com/docs/chat/sdk/v4/javascript/message/managing-read-status-in-a-group-channel/mark-messages-as-unread) - API pattern for mark as unread
- [Building Scalable Chat with Redis and PostgreSQL](https://medium.com/@indraneelsarode22neel/building-a-scalable-real-time-chat-app-from-single-server-to-distributed-powerhouse-614bb3391fa8) - Redis counter patterns

### Tertiary (LOW confidence)
- [WhatsApp Mark as Read/Unread](https://www.idownloadblog.com/2025/02/17/mark-whatsapp-message-read-unread/) - UX reference
- [Google Chat Mark as Read/Unread](https://support.google.com/chat/answer/9965883) - UX reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, uses existing infrastructure
- Architecture: HIGH - Sequence-based tracking is well-established pattern
- Read state schema: HIGH - Follows industry standard per-channel tracking
- Cache pattern: HIGH - Redis + PostgreSQL is proven pattern
- Pitfalls: MEDIUM - Based on documented patterns, not OComms-specific testing

**Research date:** 2026-01-18
**Valid until:** 2026-02-18 (30 days - patterns are stable, implementation may reveal edge cases)

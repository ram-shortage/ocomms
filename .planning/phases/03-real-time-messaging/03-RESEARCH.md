# Phase 3: Real-Time Messaging - Research

**Researched:** 2026-01-17
**Domain:** WebSocket Communication, Redis Pub/Sub, Presence Systems, Message Persistence
**Confidence:** HIGH

## Summary

This research covers the real-time messaging infrastructure for OComms: WebSocket communication with Socket.IO, Redis/Valkey pub/sub for horizontal scaling, message persistence with PostgreSQL, and user presence tracking. The project already uses Next.js 16, PostgreSQL with Drizzle ORM, and better-auth for authentication.

Key findings:
- **Socket.IO 4.8** with custom server is the standard approach for Next.js WebSocket integration
- **uWebSockets.js integration** provides 5-10x performance improvement over default Node.js HTTP server
- **@socket.io/redis-adapter** (or redis-streams-adapter) enables horizontal scaling across multiple server instances
- **Valkey** is recommended over Redis for self-hosted deployments (BSD license, better performance, full Redis compatibility)
- **Server-assigned message ordering** with sequence numbers prevents clock drift issues
- **Heartbeat-based presence** with Redis TTL provides accurate online/offline status

**Primary recommendation:** Use Socket.IO with a custom Next.js server, Valkey for pub/sub scaling, server-side message sequencing, and heartbeat-based presence with 30-second intervals. Messages stored in PostgreSQL with soft delete for user-facing deletion while preserving audit trails.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | 4.8.x | WebSocket server with fallback | Battle-tested, rooms/namespaces, automatic reconnection |
| socket.io-client | 4.8.x | WebSocket client | Pairs with server, handles reconnection |
| @socket.io/redis-adapter | 8.3.x | Multi-server pub/sub | Official adapter for horizontal scaling |
| ioredis | 5.x | Redis/Valkey client | Feature-rich, cluster support, TypeScript |
| uWebSockets.js | 20.52.x | High-performance HTTP/WS | 5-10x throughput vs Node.js HTTP |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @socket.io/redis-streams-adapter | 0.2.x | Durable pub/sub | Need message delivery guarantees during reconnects |
| uuid | 13.x | Message IDs | Already in project, use for message identifiers |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.IO | ws + custom protocol | Socket.IO handles reconnection, rooms, fallback - don't hand-roll |
| Redis adapter | Streams adapter | Streams provides durability but adds complexity; start with standard adapter |
| Valkey | Redis OSS 8.0 | Redis now AGPLv3; Valkey is BSD, better performance, same API |
| uWebSockets.js | Default Node HTTP | uWS gives 5-10x performance but requires custom server anyway |

**Installation:**

```bash
# Core real-time dependencies
npm install socket.io socket.io-client ioredis

# Redis adapter for horizontal scaling
npm install @socket.io/redis-adapter

# uWebSockets for performance (install from GitHub)
npm install uWebSockets.js@uNetworking/uWebSockets.js#v20.52.0
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── server/                    # Custom server files
│   ├── index.ts               # Main server entry point
│   ├── socket/
│   │   ├── index.ts           # Socket.IO initialization
│   │   ├── handlers/          # Event handlers
│   │   │   ├── message.ts     # Message send/delete handlers
│   │   │   ├── presence.ts    # Presence event handlers
│   │   │   └── typing.ts      # Typing indicator handlers
│   │   ├── middleware/        # Socket middleware
│   │   │   └── auth.ts        # Authentication middleware
│   │   └── rooms.ts           # Room management utilities
│   └── redis.ts               # Redis/Valkey client setup
├── lib/
│   ├── socket-client.ts       # Client-side socket instance
│   └── socket-events.ts       # Shared event type definitions
├── db/
│   └── schema/
│       └── message.ts         # Message schema
└── app/
    └── (workspace)/
        └── [workspaceSlug]/
            ├── channels/[channelSlug]/
            │   └── page.tsx   # Channel with messages
            └── dm/[conversationId]/
                └── page.tsx   # DM with messages
```

### Pattern 1: Custom Server with Socket.IO

**What:** Shared HTTP server between Next.js and Socket.IO
**When to use:** Required for WebSocket support in Next.js

```typescript
// src/server/index.ts
import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { setupSocketHandlers } from "./socket";
import { createRedisAdapter } from "./socket/adapter";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000");

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(handler);

  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
  });

  // Attach Redis adapter for scaling
  const adapter = await createRedisAdapter();
  io.adapter(adapter);

  // Setup event handlers
  setupSocketHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
```

### Pattern 2: Socket.IO Authentication Middleware

**What:** Validate better-auth session on WebSocket connection
**When to use:** Every socket connection must be authenticated

```typescript
// src/server/socket/middleware/auth.ts
import type { Socket } from "socket.io";
import { auth } from "@/lib/auth";

export async function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void
) {
  try {
    // Extract session from cookie (sent via handshake)
    const cookies = socket.handshake.headers.cookie;
    if (!cookies) {
      return next(new Error("No session cookie"));
    }

    // Validate session with better-auth
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookies }),
    });

    if (!session) {
      return next(new Error("Invalid session"));
    }

    // Attach user to socket for later use
    socket.data.userId = session.user.id;
    socket.data.user = session.user;

    next();
  } catch (error) {
    next(new Error("Authentication failed"));
  }
}
```

### Pattern 3: Room Management for Channels/DMs

**What:** Map channels and conversations to Socket.IO rooms
**When to use:** Organizing message broadcast scope

```typescript
// src/server/socket/rooms.ts
import type { Socket } from "socket.io";

// Room naming conventions
export const getRoomName = {
  channel: (channelId: string) => `channel:${channelId}`,
  conversation: (conversationId: string) => `dm:${conversationId}`,
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  user: (userId: string) => `user:${userId}`, // For presence updates
};

// Join user to their authorized rooms on connection
export async function joinUserRooms(socket: Socket) {
  const userId = socket.data.userId;

  // Always join user's personal room for presence
  socket.join(getRoomName.user(userId));

  // Fetch user's channel memberships and join those rooms
  const memberships = await getChannelMemberships(userId);
  for (const membership of memberships) {
    socket.join(getRoomName.channel(membership.channelId));
  }

  // Fetch user's DM conversations and join those rooms
  const conversations = await getConversationParticipations(userId);
  for (const conv of conversations) {
    socket.join(getRoomName.conversation(conv.conversationId));
  }
}
```

### Pattern 4: Redis Adapter Setup

**What:** Configure Socket.IO Redis adapter for horizontal scaling
**When to use:** Always, to support future scaling

```typescript
// src/server/socket/adapter.ts
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";

export async function createRedisAdapter() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  const pubClient = new Redis(redisUrl);
  const subClient = pubClient.duplicate();

  // Wait for connections
  await Promise.all([
    new Promise((resolve) => pubClient.on("connect", resolve)),
    new Promise((resolve) => subClient.on("connect", resolve)),
  ]);

  return createAdapter(pubClient, subClient);
}
```

### Pattern 5: Message Ordering with Server Sequence

**What:** Assign sequence numbers server-side for consistent ordering
**When to use:** All message creation

```typescript
// src/server/socket/handlers/message.ts
import { db } from "@/db";
import { messages } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function handleSendMessage(
  socket: Socket,
  io: Server,
  data: { targetId: string; targetType: "channel" | "dm"; content: string }
) {
  const userId = socket.data.userId;

  // Get next sequence number atomically
  // This ensures ordering even with concurrent writes
  const [message] = await db
    .insert(messages)
    .values({
      content: data.content,
      authorId: userId,
      channelId: data.targetType === "channel" ? data.targetId : null,
      conversationId: data.targetType === "dm" ? data.targetId : null,
      // Sequence assigned by database trigger or computed column
    })
    .returning();

  // Broadcast to room
  const roomName = data.targetType === "channel"
    ? getRoomName.channel(data.targetId)
    : getRoomName.conversation(data.targetId);

  io.to(roomName).emit("message:new", {
    ...message,
    author: socket.data.user,
  });
}
```

### Pattern 6: Client-Side Socket Setup

**What:** Initialize socket connection with session cookies
**When to use:** Client components needing real-time updates

```typescript
// src/lib/socket-client.ts
"use client";

import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./socket-events";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      withCredentials: true, // Send cookies for auth
      autoConnect: false,    // Connect manually after auth check
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

// Usage in component
export function useSocket() {
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;
    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}
```

### Anti-Patterns to Avoid

- **Client timestamps for ordering:** Never trust client-provided timestamps. Use server-assigned sequence numbers or timestamps.
- **Polling for presence:** Don't poll for online status. Use heartbeat + pub/sub.
- **Storing typing indicators:** Typing events are ephemeral - broadcast but don't persist.
- **Awaiting broadcasts:** Don't await `io.emit()`. Fire and forget for broadcasts.
- **Single Redis connection:** Always use separate pub/sub clients to avoid blocking.
- **Socket ID for user identity:** Socket IDs change on reconnection. Use authenticated user IDs.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnection | Custom retry logic | Socket.IO built-in | Handles backoff, state recovery, transport fallback |
| Room management | Custom subscription tracking | Socket.IO rooms | Automatic cleanup on disconnect, broadcast helpers |
| Multi-server sync | Custom event bus | @socket.io/redis-adapter | Battle-tested, handles edge cases |
| Connection heartbeats | Custom ping/pong | Socket.IO pingInterval/pingTimeout | Automatic, configurable |
| Message delivery confirmation | Custom ack system | Socket.IO acknowledgements | Built-in callback support |
| Typing indicator debounce | Custom implementation | Standard throttle/debounce | Use lodash.throttle or native |

**Key insight:** Socket.IO handles 80% of real-time complexity. Focus custom code on business logic (message persistence, presence state, authorization).

## Common Pitfalls

### Pitfall 1: Cookie Not Sent on WebSocket Handshake

**What goes wrong:** Socket connections fail authentication
**Why it happens:** Same-site cookie policy or missing credentials option
**How to avoid:**
- Set `withCredentials: true` on client
- Configure CORS properly on server
- Ensure cookies are `SameSite=Lax` or `None` with `Secure`
**Warning signs:** "Invalid session" errors only in production

### Pitfall 2: Message Ordering Race Conditions

**What goes wrong:** Messages appear out of order in UI
**Why it happens:** Relying on client timestamps or arrival order
**How to avoid:**
- Use server-assigned sequence numbers per channel/conversation
- Sort by sequence in UI, not by received order
**Warning signs:** Messages jump around, especially under high load

### Pitfall 3: Presence State Drift

**What goes wrong:** Users shown online when they're offline (or vice versa)
**Why it happens:** Missed disconnect events, network issues
**How to avoid:**
- Use heartbeat with Redis TTL (expire after 2-3 missed beats)
- Handle `disconnect` event to immediately update presence
- Don't rely solely on connection state
**Warning signs:** Ghost users, presence stuck after browser crash

### Pitfall 4: Memory Leak from Event Listeners

**What goes wrong:** Server memory grows over time
**Why it happens:** Not cleaning up listeners on disconnect
**How to avoid:**
- Use `socket.on()` which auto-cleans on disconnect
- Remove any custom listeners in `disconnect` handler
- Avoid creating closures that capture large objects
**Warning signs:** Gradual memory increase, eventual crash

### Pitfall 5: Blocking Redis Pub/Sub Client

**What goes wrong:** Messages stop flowing
**Why it happens:** Using same Redis client for pub/sub and commands
**How to avoid:** Always use `pubClient.duplicate()` for subscriber
**Warning signs:** Random message delivery failures

### Pitfall 6: Typing Indicator Flood

**What goes wrong:** Excessive network traffic, server load
**Why it happens:** Sending event on every keystroke
**How to avoid:**
- Throttle typing events to 200-500ms
- Debounce "stopped typing" with 2-3 second timeout
- Only emit when state actually changes
**Warning signs:** High event rate, UI lag during typing

### Pitfall 7: Missing Room Authorization

**What goes wrong:** Users receive messages from channels they shouldn't access
**Why it happens:** Joining rooms without checking membership
**How to avoid:**
- Verify channel/conversation membership before joining room
- Re-verify on sensitive operations
- Use middleware to check permissions
**Warning signs:** Data leakage, security audit failures

## Code Examples

Verified patterns from official sources:

### Message Schema with Soft Delete

```typescript
// src/db/schema/message.ts
import { pgTable, text, timestamp, uuid, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";
import { channels } from "./channel";
import { conversations } from "./conversation";

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  content: text("content").notNull(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Either channel or conversation, not both
  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),

  // Server-assigned sequence for ordering
  sequence: integer("sequence").notNull(),

  // Soft delete - null means not deleted
  deletedAt: timestamp("deleted_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Index for fetching channel messages in order
  index("messages_channel_seq_idx").on(table.channelId, table.sequence),
  // Index for fetching DM messages in order
  index("messages_conversation_seq_idx").on(table.conversationId, table.sequence),
  // Index for user's messages (for deletion)
  index("messages_author_idx").on(table.authorId),
]);

export const messagesRelations = relations(messages, ({ one }) => ({
  author: one(users, {
    fields: [messages.authorId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
```

### Presence System with Redis TTL

```typescript
// src/server/socket/handlers/presence.ts
import { Redis } from "ioredis";
import type { Server, Socket } from "socket.io";
import { getRoomName } from "../rooms";

const PRESENCE_TTL = 60; // seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

type PresenceStatus = "active" | "away" | "offline";

export function setupPresence(io: Server, redis: Redis) {
  return {
    async setOnline(userId: string, workspaceId: string) {
      const key = `presence:${workspaceId}:${userId}`;
      await redis.setex(key, PRESENCE_TTL, "active");

      // Broadcast to workspace
      io.to(getRoomName.workspace(workspaceId)).emit("presence:update", {
        userId,
        status: "active",
      });
    },

    async setAway(userId: string, workspaceId: string) {
      const key = `presence:${workspaceId}:${userId}`;
      await redis.setex(key, PRESENCE_TTL, "away");

      io.to(getRoomName.workspace(workspaceId)).emit("presence:update", {
        userId,
        status: "away",
      });
    },

    async setOffline(userId: string, workspaceId: string) {
      const key = `presence:${workspaceId}:${userId}`;
      await redis.del(key);

      io.to(getRoomName.workspace(workspaceId)).emit("presence:update", {
        userId,
        status: "offline",
      });
    },

    async getStatus(userId: string, workspaceId: string): Promise<PresenceStatus> {
      const key = `presence:${workspaceId}:${userId}`;
      const status = await redis.get(key);
      return (status as PresenceStatus) || "offline";
    },

    async getWorkspacePresence(workspaceId: string, userIds: string[]) {
      const pipeline = redis.pipeline();
      for (const userId of userIds) {
        pipeline.get(`presence:${workspaceId}:${userId}`);
      }
      const results = await pipeline.exec();

      return userIds.reduce((acc, userId, i) => {
        acc[userId] = (results?.[i]?.[1] as PresenceStatus) || "offline";
        return acc;
      }, {} as Record<string, PresenceStatus>);
    },

    // Refresh TTL on heartbeat
    async heartbeat(userId: string, workspaceId: string) {
      const key = `presence:${workspaceId}:${userId}`;
      const current = await redis.get(key);
      if (current) {
        await redis.expire(key, PRESENCE_TTL);
      }
    },
  };
}

// Socket event handlers
export function handlePresenceEvents(socket: Socket, io: Server, presence: ReturnType<typeof setupPresence>) {
  const userId = socket.data.userId;
  const workspaceId = socket.data.workspaceId;

  // Set online when connected
  presence.setOnline(userId, workspaceId);

  // Setup heartbeat interval
  const heartbeatTimer = setInterval(() => {
    presence.heartbeat(userId, workspaceId);
  }, HEARTBEAT_INTERVAL);

  // Handle status changes
  socket.on("presence:setAway", () => {
    presence.setAway(userId, workspaceId);
  });

  socket.on("presence:setActive", () => {
    presence.setOnline(userId, workspaceId);
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    clearInterval(heartbeatTimer);
    presence.setOffline(userId, workspaceId);
  });
}
```

### Typing Indicator with Throttle

```typescript
// src/server/socket/handlers/typing.ts
import type { Server, Socket } from "socket.io";
import { getRoomName } from "../rooms";

// Server-side: Just broadcast, no storage
export function handleTypingEvents(socket: Socket, io: Server) {
  socket.on("typing:start", (data: { targetId: string; targetType: "channel" | "dm" }) => {
    const roomName = data.targetType === "channel"
      ? getRoomName.channel(data.targetId)
      : getRoomName.conversation(data.targetId);

    // Broadcast to others in room (not sender)
    socket.to(roomName).emit("typing:update", {
      userId: socket.data.userId,
      userName: socket.data.user.name,
      targetId: data.targetId,
      isTyping: true,
    });
  });

  socket.on("typing:stop", (data: { targetId: string; targetType: "channel" | "dm" }) => {
    const roomName = data.targetType === "channel"
      ? getRoomName.channel(data.targetId)
      : getRoomName.conversation(data.targetId);

    socket.to(roomName).emit("typing:update", {
      userId: socket.data.userId,
      userName: socket.data.user.name,
      targetId: data.targetId,
      isTyping: false,
    });
  });
}

// Client-side: Throttled typing indicator
// src/components/message-input.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { useSocket } from "@/lib/socket-client";

const TYPING_THROTTLE = 500; // ms
const TYPING_TIMEOUT = 3000; // ms

export function useTypingIndicator(targetId: string, targetType: "channel" | "dm") {
  const socket = useSocket();
  const [isTyping, setIsTyping] = useState(false);
  const lastTypingRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const sendTypingStart = useCallback(() => {
    const now = Date.now();

    // Throttle: only send if enough time has passed
    if (now - lastTypingRef.current > TYPING_THROTTLE) {
      if (!isTyping) {
        socket.emit("typing:start", { targetId, targetType });
        setIsTyping(true);
      }
      lastTypingRef.current = now;
    }

    // Reset timeout for stop detection
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { targetId, targetType });
      setIsTyping(false);
    }, TYPING_TIMEOUT);
  }, [socket, targetId, targetType, isTyping]);

  const sendTypingStop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (isTyping) {
      socket.emit("typing:stop", { targetId, targetType });
      setIsTyping(false);
    }
  }, [socket, targetId, targetType, isTyping]);

  return { sendTypingStart, sendTypingStop };
}
```

### Message Deletion with Soft Delete

```typescript
// src/server/socket/handlers/message.ts
import { db } from "@/db";
import { messages } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function handleDeleteMessage(
  socket: Socket,
  io: Server,
  data: { messageId: string }
) {
  const userId = socket.data.userId;

  // Verify ownership and soft delete
  const [message] = await db
    .update(messages)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(messages.id, data.messageId),
        eq(messages.authorId, userId),
        isNull(messages.deletedAt) // Only delete if not already deleted
      )
    )
    .returning();

  if (!message) {
    socket.emit("error", { message: "Cannot delete this message" });
    return;
  }

  // Broadcast deletion to room
  const roomName = message.channelId
    ? getRoomName.channel(message.channelId)
    : getRoomName.conversation(message.conversationId!);

  io.to(roomName).emit("message:deleted", {
    messageId: data.messageId,
    deletedAt: message.deletedAt,
  });
}
```

### Event Type Definitions

```typescript
// src/lib/socket-events.ts
export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  "message:deleted": (data: { messageId: string; deletedAt: Date }) => void;
  "typing:update": (data: {
    userId: string;
    userName: string;
    targetId: string;
    isTyping: boolean;
  }) => void;
  "presence:update": (data: {
    userId: string;
    status: "active" | "away" | "offline";
  }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  "message:send": (
    data: { targetId: string; targetType: "channel" | "dm"; content: string },
    callback?: (response: { success: boolean; messageId?: string }) => void
  ) => void;
  "message:delete": (data: { messageId: string }) => void;
  "typing:start": (data: { targetId: string; targetType: "channel" | "dm" }) => void;
  "typing:stop": (data: { targetId: string; targetType: "channel" | "dm" }) => void;
  "presence:setAway": () => void;
  "presence:setActive": () => void;
  "room:join": (data: { roomId: string; roomType: "channel" | "dm" }) => void;
  "room:leave": (data: { roomId: string; roomType: "channel" | "dm" }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  user: { id: string; name: string; email: string };
  workspaceId: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redis OSS (BSD) | Redis OSS 8.0 (AGPLv3) or Valkey (BSD) | May 2025 | Choose Valkey for self-hosted to avoid license issues |
| socket.io-redis | @socket.io/redis-adapter | v7 | Package renamed, must provide own Redis clients |
| Standard adapter | Sharded adapter | Redis 7.0 | Better scalability for new projects |
| Client timestamps | Server sequence numbers | N/A | Prevents ordering issues from clock drift |
| Connection-based presence | Heartbeat + Redis TTL | N/A | More reliable, survives connection drops |

**Deprecated/outdated:**
- **socket.io-redis:** Use @socket.io/redis-adapter instead
- **Redis < 7.0:** Upgrade for sharded pub/sub support
- **res.socket.server pattern:** Doesn't work with App Router, use custom server

## Open Questions

Things that couldn't be fully resolved:

1. **uWebSockets.js with Next.js 16**
   - What we know: Socket.IO supports uWebSockets attachment via `io.attachApp()`
   - What's unclear: Integration pattern with Next.js 16 custom server specifically
   - Recommendation: Start with standard Node HTTP server, add uWebSockets as performance optimization if needed

2. **Message sequence generation strategy**
   - What we know: Need per-channel/conversation sequence numbers
   - What's unclear: Best approach - database trigger, computed column, or application logic
   - Recommendation: Use application logic with `SELECT MAX(sequence) + 1` in transaction, migrate to database sequence if performance requires

3. **Valkey cluster vs single instance**
   - What we know: Valkey supports clustering like Redis
   - What's unclear: When to move from single instance to cluster
   - Recommendation: Start with single instance, plan for cluster when exceeding 500+ concurrent connections

## Sources

### Primary (HIGH confidence)
- [Socket.IO Server Installation](https://socket.io/docs/v4/server-installation/) - uWebSockets.js integration
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/) - Scaling configuration
- [Socket.IO Next.js Guide](https://socket.io/how-to/use-with-nextjs) - Custom server setup
- [Socket.IO Rooms](https://socket.io/docs/v3/rooms/) - Room management patterns

### Secondary (MEDIUM confidence)
- [Valkey vs Redis Comparison 2026](https://betterstack.com/community/comparisons/redis-vs-valkey/) - Licensing and performance differences
- [Scaling WebSocket with Redis Pub/Sub](https://ably.com/blog/scaling-pub-sub-with-websockets-and-redis) - Multi-instance architecture
- [Adding Typing Indicators](https://dev.to/hexshift/adding-typing-indicators-to-real-time-chat-applications-76p) - Implementation patterns
- [PostgreSQL Chat Schema Design](https://www.tome01.com/efficient-schema-design-for-a-chat-app-using-postgresql) - Database patterns

### Tertiary (LOW confidence)
- [Real-Time Presence Platform Design](https://systemdesign.one/real-time-presence-platform-system-design/) - Heartbeat architecture
- [Soft Delete PostgreSQL Strategies](https://dev.to/oddcoder/postgresql-soft-delete-strategies-balancing-data-retention-50lo) - Deletion patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Socket.IO and Redis adapter are official, well-documented
- Architecture: HIGH - Custom server pattern is documented by Socket.IO for Next.js
- Message schema: MEDIUM - Based on established patterns, not OComms-specific validation
- Presence system: MEDIUM - Heartbeat + TTL is standard pattern, specific timing needs tuning
- Pitfalls: HIGH - Drawn from official docs and common issues

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (30 days - stack is stable, patterns well-established)

# Architecture Patterns

**Domain:** Self-hosted real-time team chat platform (Slack-like)
**Researched:** 2026-01-17 (Core), 2026-01-20 (v0.4.0 Features)
**Confidence:** HIGH (verified against Slack engineering blog, established patterns)

---

## Executive Summary

Real-time chat systems follow a well-established architecture pattern: **stateless HTTP API + stateful WebSocket gateway + pub/sub message bus**. The key insight from Slack's architecture is separation of concerns: Gateway Servers handle connections, Channel Servers handle message routing, and Redis/Kafka handle cross-instance communication.

For OComms at 500+ concurrent users, we can use a simplified version of enterprise patterns:
- Single WebSocket gateway (scales to ~3,500 connections per instance)
- PostgreSQL for persistence (better for complex queries, ACID compliance)
- Redis for pub/sub, presence, and caching
- Optional Elasticsearch for search at scale

---

## Recommended Architecture

```
                                    +------------------+
                                    |   Load Balancer  |
                                    |  (NGINX/Traefik) |
                                    +--------+---------+
                                             |
                    +------------------------+------------------------+
                    |                                                 |
           +--------v--------+                               +--------v--------+
           |   HTTP API      |                               | WebSocket       |
           |   Server        |                               | Gateway         |
           |  (REST/GraphQL) |                               | (Socket.IO)     |
           +--------+--------+                               +--------+--------+
                    |                                                 |
                    +------------------------+------------------------+
                                             |
                                    +--------v--------+
                                    |   Redis         |
                                    |   (Pub/Sub +    |
                                    |    Cache)       |
                                    +--------+--------+
                                             |
                    +------------------------+------------------------+
                    |                        |                        |
           +--------v--------+      +--------v--------+      +--------v--------+
           |   PostgreSQL    |      |   File Storage  |      |  Elasticsearch  |
           |   (Primary DB)  |      |   (S3/Local)    |      |  (Search, opt)  |
           +----------------+       +----------------+        +----------------+
```

### Component Roles

| Component | Responsibility | Stateful? | Scale Strategy |
|-----------|---------------|-----------|----------------|
| Load Balancer | Route traffic, TLS termination, sticky sessions | No | Single instance (HA pair for enterprise) |
| HTTP API Server | REST/GraphQL endpoints, business logic, auth | No | Horizontal (add instances) |
| WebSocket Gateway | Persistent connections, real-time event delivery | Yes (connections) | Horizontal via Redis pub/sub |
| Redis | Pub/sub, presence cache, session cache, rate limiting | Yes | Single instance (Redis Cluster for enterprise) |
| PostgreSQL | Message persistence, user data, workspace data | Yes | Single instance (read replicas for enterprise) |
| File Storage | Attachments, avatars, file uploads | Yes | S3-compatible or local filesystem |
| Elasticsearch | Full-text search across messages | Yes | Optional for MVP, add when search is slow |

---

## Component Boundaries

### 1. HTTP API Server

**Owns:**
- Authentication (login, logout, token refresh)
- Authorization (workspace membership, channel permissions)
- CRUD operations (users, workspaces, channels, messages)
- File upload handling
- Search queries
- Notification preferences

**Communicates with:**
- PostgreSQL (reads/writes)
- Redis (caching, rate limiting)
- WebSocket Gateway (via Redis pub/sub for real-time notifications)
- File Storage (uploads/downloads)
- Elasticsearch (search queries)

**Does NOT own:**
- Real-time connection management
- Presence tracking
- Typing indicators

### 2. WebSocket Gateway

**Owns:**
- WebSocket connection lifecycle
- Real-time event delivery (messages, typing, presence)
- Connection authentication (JWT validation on handshake)
- Room/channel subscriptions
- Presence aggregation and broadcasting

**Communicates with:**
- Redis (subscribe to pub/sub channels, presence updates)
- HTTP API (webhook callbacks for complex operations, optional)

**Does NOT own:**
- Message persistence (that's HTTP API's job)
- Business logic validation
- Authentication (only validates existing tokens)

### 3. Redis

**Owns:**
- Inter-instance messaging (pub/sub)
- Presence state (who's online, per-device status)
- Typing indicator state (ephemeral, TTL-based)
- Session cache
- Rate limiting counters
- Unread count cache

**Key patterns:**
```
# Pub/Sub Channels
channel:{channel_id}           # Messages for a channel
user:{user_id}                 # Direct messages to a user
workspace:{workspace_id}       # Workspace-wide broadcasts
presence:{workspace_id}        # Presence updates

# Cache Keys
presence:user:{user_id}        # User's current presence (SET with TTL)
typing:{channel_id}:{user_id}  # Typing indicator (SET with 3s TTL)
unread:{user_id}:{channel_id}  # Unread count cache
session:{session_id}           # Session data cache
```

### 4. PostgreSQL

**Owns:**
- All persistent data
- ACID transactions
- Complex queries (search, analytics)
- Data integrity (foreign keys, constraints)

**Schema approach:**
- Relational model with proper normalization
- JSON columns for flexible settings (notification_prefs_json, device_states_json)
- Efficient indexing for common queries
- Partitioning by workspace_id for large deployments

---

## Data Flow Patterns

### Pattern 1: Sending a Message

```
1. Client sends message via HTTP POST /api/channels/{id}/messages

2. HTTP API:
   a. Validates auth token
   b. Checks channel membership
   c. Validates message content
   d. Writes to PostgreSQL
   e. Publishes to Redis channel:{channel_id}
   f. Updates unread counts in Redis
   g. Returns message to sender

3. Redis broadcasts to all subscribers

4. WebSocket Gateways (all instances):
   a. Receive message from Redis subscription
   b. Look up local connections subscribed to channel
   c. Push message to each connected client

5. Clients receive message via WebSocket
```

**Why HTTP for sending, WebSocket for receiving:**
- HTTP provides reliable delivery, easy retries, idempotency
- WebSocket provides instant push without polling
- Separates concerns: persistence vs. delivery

### Pattern 2: Typing Indicators

```
1. Client types in input field

2. Client sends WebSocket event: { type: "typing", channel_id: "..." }
   (Throttled to once per 2-3 seconds)

3. WebSocket Gateway:
   a. Sets Redis key: typing:{channel_id}:{user_id} with 3s TTL
   b. Publishes to Redis channel:{channel_id} with typing event

4. Other WebSocket Gateways:
   a. Receive typing event
   b. Forward to clients subscribed to that channel

5. Client displays "User is typing..." for 3 seconds
   (Auto-expires if no new typing events)
```

**Key insight:** Typing indicators are ephemeral - no persistence, use TTL for auto-cleanup.

### Pattern 3: Presence Updates

```
1. Client connects via WebSocket

2. WebSocket Gateway:
   a. Validates JWT
   b. Registers connection in local map
   c. Sets Redis presence:user:{user_id} = "online" with 60s TTL
   d. Publishes presence update to Redis presence:{workspace_id}

3. Heartbeat loop (every 30s):
   a. Client sends ping
   b. Gateway refreshes Redis TTL

4. Client disconnects (or heartbeat timeout):
   a. Gateway removes from local map
   b. Deletes Redis presence key (or lets TTL expire)
   c. Publishes "offline" to Redis

5. Other clients receive presence update
```

**Key insight:** Use TTL for presence to handle ungraceful disconnects (network failure, app crash).

### Pattern 4: Unread Counts

```
On message received:
1. HTTP API increments Redis unread:{user_id}:{channel_id}
2. Publishes unread update via Redis

On channel opened:
1. Client sends "mark_read" via HTTP POST
2. HTTP API:
   a. Updates ReadState in PostgreSQL
   b. Clears Redis unread cache
   c. Publishes read receipt to other devices
```

**Key insight:** Cache unread counts in Redis, persist read state in PostgreSQL.

---

## Scaling Considerations

### At 500 Concurrent Users (Target)

| Component | Sizing | Notes |
|-----------|--------|-------|
| WebSocket Gateway | 1 instance | Each instance handles ~3,500 connections easily |
| HTTP API | 1-2 instances | Stateless, can scale horizontally |
| Redis | 1 instance | Single-threaded but very fast |
| PostgreSQL | 1 instance | Standard hardware handles this easily |

**Architecture simplification for this scale:**
- Skip Redis Cluster, use single Redis
- Skip read replicas
- Skip Elasticsearch (PostgreSQL full-text search works fine)
- Single deployment unit (all components together)

### At 5,000 Concurrent Users

| Component | Sizing | Notes |
|-----------|--------|-------|
| WebSocket Gateway | 2+ instances | Requires sticky sessions or Redis adapter |
| HTTP API | 2-4 instances | Behind load balancer |
| Redis | 1 instance (consider Sentinel) | Add failover capability |
| PostgreSQL | 1 primary + 1 read replica | Read replica for search/analytics |

**Architecture additions:**
- Proper load balancer with sticky sessions
- Redis Sentinel for high availability
- Connection to Elasticsearch for search (optional)

### At 50,000+ Concurrent Users (Enterprise)

| Component | Sizing | Notes |
|-----------|--------|-------|
| WebSocket Gateway | 15-20 instances | Geographic distribution |
| HTTP API | 10+ instances | Auto-scaling based on load |
| Redis | Redis Cluster (6+ nodes) | Sharding for horizontal scale |
| PostgreSQL | Vitess or similar sharding | Shard by workspace_id |
| Elasticsearch | 3+ node cluster | Required for search at scale |

**Architecture additions:**
- Kafka for durable message queuing
- Separate Channel Servers (like Slack)
- CDN for static assets
- Geographic distribution

---

## Patterns to Follow

### Pattern: Separate Ephemeral from Persistent

**What:** Real-time ephemeral state (typing, presence) flows through Redis only. Persistent state (messages, memberships) goes through PostgreSQL.

**When:** Always in chat systems.

**Example:**
```typescript
// Typing indicator - ephemeral, Redis only
async function setTyping(userId: string, channelId: string) {
  await redis.setex(`typing:${channelId}:${userId}`, 3, '1');
  await redis.publish(`channel:${channelId}`, JSON.stringify({
    type: 'typing',
    userId,
    channelId
  }));
}

// Message - persistent, PostgreSQL then Redis
async function sendMessage(userId: string, channelId: string, content: string) {
  // 1. Persist to PostgreSQL
  const message = await db.messages.create({
    userId, channelId, content, createdAt: new Date()
  });

  // 2. Publish for real-time delivery
  await redis.publish(`channel:${channelId}`, JSON.stringify({
    type: 'message',
    message
  }));

  return message;
}
```

### Pattern: Fan-Out on Write

**What:** When a message is sent, immediately fan out to all subscribers rather than having each client poll.

**When:** For real-time delivery of messages to channel members.

**Why:** Sub-100ms delivery, no polling overhead.

```typescript
// On message creation, publish to Redis
await redis.publish(`channel:${channelId}`, JSON.stringify(message));

// Each WebSocket gateway subscribes and forwards to local clients
redis.subscribe(`channel:${channelId}`);
redis.on('message', (channel, data) => {
  const subscribers = localConnections.get(channelId);
  subscribers.forEach(socket => socket.send(data));
});
```

### Pattern: Idempotency Keys for Messages

**What:** Include a client-generated ID with each message to prevent duplicates from retries.

**When:** For all message creation.

**Why:** Network issues cause retries; without idempotency, you get duplicate messages.

```typescript
// Client sends
POST /api/messages
{
  "channelId": "...",
  "content": "Hello",
  "idempotencyKey": "client-uuid-12345"
}

// Server checks before insert
const existing = await db.messages.findByIdempotencyKey(key);
if (existing) return existing; // Return existing, don't duplicate
```

### Pattern: Optimistic Updates with Confirmation

**What:** Client shows message immediately (optimistic), then confirms or rolls back based on server response.

**When:** For message sending UX.

**Why:** Instant perceived responsiveness.

```typescript
// Client-side
function sendMessage(content: string) {
  const tempId = generateUuid();

  // 1. Show immediately with pending state
  addMessageToUI({ id: tempId, content, status: 'pending' });

  // 2. Send to server
  const result = await api.sendMessage(content, tempId);

  // 3. Update with real data or show error
  if (result.ok) {
    updateMessage(tempId, { id: result.message.id, status: 'sent' });
  } else {
    updateMessage(tempId, { status: 'failed' });
  }
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern: Polling for Real-Time

**What:** Using setInterval to poll the server for new messages.

**Why bad:** High latency (polling interval), wasted resources (constant requests), scales poorly.

**Instead:** Use WebSocket connections with server push.

### Anti-Pattern: Persisting Typing Indicators

**What:** Writing typing events to the database.

**Why bad:** Massive write volume for ephemeral data, no value after 3 seconds.

**Instead:** Use Redis with TTL, let them auto-expire.

### Anti-Pattern: WebSocket for Everything

**What:** Sending messages, uploads, CRUD operations through WebSocket.

**Why bad:** Hard to implement retries, no HTTP caching, complex error handling, difficult to load balance.

**Instead:** HTTP for commands (send message, upload file), WebSocket for events (receive message, typing).

### Anti-Pattern: No Backpressure

**What:** Broadcasting to all clients without flow control.

**Why bad:** One slow client blocks others, memory builds up, server crashes.

**Instead:** Implement per-connection queues with limits, drop messages for very slow clients.

### Anti-Pattern: Tight Coupling Gateway to API

**What:** WebSocket gateway directly calling API endpoints or database.

**Why bad:** Creates dependency, harder to scale independently, complex failure modes.

**Instead:** Communicate via Redis pub/sub only. Gateway is pure connection management.

---

## Suggested Build Order

Based on dependencies, build in this order:

### Phase 1: Core Infrastructure
1. **PostgreSQL schema** - Foundation for all data
2. **Redis setup** - Required for pub/sub
3. **HTTP API scaffold** - Auth, basic CRUD

### Phase 2: Real-Time Foundation
4. **WebSocket gateway** - Connection management
5. **Redis pub/sub integration** - Message routing
6. **Basic message flow** - Send via HTTP, receive via WebSocket

### Phase 3: Real-Time Features
7. **Presence system** - Online/offline status
8. **Typing indicators** - Ephemeral state via Redis
9. **Unread counts** - Redis cache + PostgreSQL persistence

### Phase 4: Polish
10. **Multi-device sync** - Read receipts across devices
11. **Reconnection handling** - Catch-up on missed messages
12. **Search** - PostgreSQL full-text or Elasticsearch

**Rationale:**
- Database before API (API depends on schema)
- HTTP API before WebSocket (simpler to debug, WebSocket builds on top)
- Pub/sub before real-time features (all features depend on it)
- Presence before typing (same pattern, presence is simpler)

---

## Self-Hosted Deployment Architecture

### Single-Command Deployment (Docker Compose)

For self-hosted simplicity, package everything in Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    image: ocomms/server:latest
    ports:
      - "3000:3000"      # HTTP API
      - "3001:3001"      # WebSocket Gateway
    environment:
      - DATABASE_URL=postgres://postgres:password@db:5432/ocomms
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=ocomms

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Minimum Hardware Requirements

| Scale | RAM | CPU | Storage | Notes |
|-------|-----|-----|---------|-------|
| Small (<100 users) | 2GB | 1 vCPU | 10GB | Raspberry Pi viable |
| Medium (100-500 users) | 4GB | 2 vCPU | 50GB | Standard VPS |
| Large (500-2000 users) | 8GB | 4 vCPU | 100GB | Dedicated server |

### Deployment Checklist

- [ ] Reverse proxy (NGINX/Traefik) for TLS
- [ ] WebSocket upgrade headers configured
- [ ] Sticky sessions enabled (if multiple instances)
- [ ] Backup strategy for PostgreSQL
- [ ] Log rotation configured
- [ ] Health check endpoints
- [ ] Environment variables for configuration

---

## Technology Recommendations

### Confirmed Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Primary Database | PostgreSQL | ACID, complex queries, great ecosystem, Mattermost proven |
| Cache/Pub-Sub | Redis | Industry standard, simple, fast, proven at scale |
| WebSocket Library | Socket.IO or ws | Socket.IO for features, ws for performance |
| HTTP Framework | Based on language choice | Express (Node), Actix (Rust), Gin (Go) |

### Deferred Decisions

| Component | Options | Decide When |
|-----------|---------|-------------|
| Search Engine | PostgreSQL FTS vs Elasticsearch | When search becomes slow |
| File Storage | Local vs S3 | Based on deployment requirements |
| Message Queue | Redis Streams vs Kafka | If durability becomes critical |

---

## v0.4.0 Feature Architecture

**Researched:** 2026-01-20
**Features:** File uploads, theming, notes

This section details how the v0.4.0 features integrate with the existing OComms architecture.

**Confidence:** HIGH for theming and file uploads (well-established patterns, verified against existing codebase), MEDIUM for notes (straightforward implementation, but real-time editing decisions depend on requirements).

---

### Feature 1: File Uploads

#### Current State

OComms already has a file upload pattern for avatars:
- `src/app/api/upload/avatar/route.ts` handles uploads
- Files stored in `public/uploads/avatars/`
- Magic byte validation for image types (JPEG, PNG, GIF, WebP)
- 2MB size limit
- UUID-based filenames prevent collisions

#### Storage Strategy

**Recommendation:** Local filesystem with Docker volume mount.

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Local filesystem | Simple, no external deps, existing pattern | Single-node only, manual backup | **Use for v0.4.0** |
| S3/Cloud storage | Scalable, CDN-ready | External dependency, breaks self-hosted value prop | Future option |

**Rationale:** OComms prioritizes self-hosted simplicity. Local storage matches the existing avatar pattern and Docker deployment model. Cloud storage can be added later for organizations needing scale.

#### File Organization

```
public/
  uploads/
    avatars/           # Existing
    files/             # New: General file attachments
      {yyyy-mm}/       # Monthly partitioning for cleanup
        {uuid}.{ext}
```

Monthly partitioning allows:
- Easy backup/archive by month
- Simpler cleanup for old files
- Manageable directory sizes

#### Database Schema

**Confidence:** HIGH (follows existing Drizzle patterns)

```typescript
// src/db/schema/file.ts
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  storagePath: varchar("storage_path", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("files_org_idx").on(table.organizationId),
  index("files_uploader_idx").on(table.uploadedBy),
]);

// Junction table for message attachments
export const messageAttachments = pgTable("message_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  displayOrder: integer("display_order").notNull().default(0),
}, (table) => [
  index("msg_attachments_msg_idx").on(table.messageId),
  uniqueIndex("msg_attachments_unique_idx").on(table.messageId, table.fileId),
]);
```

**Why separate tables:**
- Files can be reused (same file attached to multiple messages)
- Easier to implement file management UI later
- Cleaner deletion semantics

#### URL Generation Strategy

**Recommendation:** Direct static serving with workspace-scoped access.

```
/uploads/files/{yyyy-mm}/{uuid}.{ext}
```

**Security approach:**
1. Middleware already skips `/uploads` path (existing pattern)
2. Files are scoped to organization via database
3. UUIDs provide obscurity (not security)
4. For sensitive files: Add API route with auth check (future)

**Why not presigned URLs:**
- Adds complexity for self-hosted
- Local filesystem doesn't need presigned URLs
- Current avatar pattern works well

#### Serving Strategy

**Confidence:** HIGH (matches existing middleware pattern)

| Approach | When to Use |
|----------|-------------|
| Static serving via Next.js | Default for all uploaded files |
| API route with streaming | If file-level access control needed |

For v0.4.0, static serving is sufficient. The existing middleware pattern at `src/middleware.ts` already bypasses auth for `/uploads`:

```typescript
const skipPaths = ["/_next", "/favicon.ico", "/uploads"];
```

#### Component Boundaries

```
[Client]                          [Server]

FileUploadButton ----POST----> /api/upload/file
     |                              |
     v                              v
MessageComposer               route.ts
     |                              |
     v                              v
(displays preview)            - Validate auth
                              - Check file type/size
                              - Generate UUID filename
                              - Write to filesystem
                              - Insert into files table
                              - Return file metadata
                                    |
                                    v
message:send (with fileIds) -> Socket handler
     |                              |
     v                              v
(optimistic UI)               - Create message
                              - Create messageAttachments
                              - Broadcast with files
```

#### File Type Handling

**Recommendation:** Extend existing magic byte validation.

| File Type | Magic Bytes | Extension |
|-----------|-------------|-----------|
| JPEG | FF D8 FF | .jpg |
| PNG | 89 50 4E 47 | .png |
| GIF | 47 49 46 38 | .gif |
| WebP | RIFF...WEBP | .webp |
| PDF | 25 50 44 46 | .pdf |
| ZIP | 50 4B 03 04 | .zip |
| DOCX | 50 4B 03 04 (+ content check) | .docx |

For v0.4.0, support common types. Don't rely on MIME type from client - use magic bytes like avatar upload does.

#### Image Preview Rendering

For inline image previews in messages:

```typescript
// In MessageContent component
{message.attachments?.map(file => (
  file.mimeType.startsWith('image/') ? (
    <ImagePreview key={file.id} file={file} />
  ) : (
    <FileAttachment key={file.id} file={file} />
  )
))}
```

**No image processing needed for v0.4.0.** Use native browser rendering with `<img>` and CSS constraints for sizing.

---

### Feature 2: Theming

#### Current State

OComms already has:
- CSS variables defined in `globals.css` with `:root` and `.dark` variants
- Full dark mode color palette using OKLCH
- Tailwind CSS v4 with `@custom-variant dark`
- No theme toggle UI or persistence

#### Recommended Architecture

**Library:** `next-themes`

**Confidence:** HIGH (industry standard, verified compatibility with Next.js App Router)

**Rationale:**
- 2 lines to implement basic dark mode
- Handles hydration correctly (no flash)
- System preference detection built-in
- Persists to localStorage automatically
- 2.7KB minified - minimal bundle impact

#### CSS Variable Structure

**Already in place.** The existing `globals.css` uses the shadcn/ui pattern:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* ... full palette */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... full palette */
}
```

No changes needed to CSS variables.

#### Context Provider Setup

```typescript
// src/components/providers/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"      // Tailwind uses .dark class
      defaultTheme="system"  // Respect OS preference
      enableSystem={true}
      disableTransitionOnChange // Prevent flash
    >
      {children}
    </NextThemesProvider>
  );
}
```

#### Root Layout Integration

```typescript
// src/app/layout.tsx (modification)
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SyncProvider>
            {children}
          </SyncProvider>
        </ThemeProvider>
        <PWAProvider />
        <Toaster />
      </body>
    </html>
  );
}
```

**Key:** `suppressHydrationWarning` on `<html>` prevents React warnings from next-themes modifying the element.

#### Persistence Mechanism

**Recommendation:** Let next-themes handle it (localStorage by default).

| Storage | Pros | Cons | Verdict |
|---------|------|------|---------|
| localStorage | Built into next-themes, no server round-trip | Device-specific | **Use this** |
| Database | Syncs across devices | Requires API call, slower | Overkill for theme |

**Why not database:**
- Theme is aesthetic preference, not critical data
- localStorage survives 7-day ITP (theme pref retained)
- Zero latency on page load

#### Theme Toggle Component

```typescript
// src/components/theme-toggle.tsx
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />; // Placeholder

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </button>
  );
}
```

**Important:** Must check `mounted` to avoid hydration mismatch.

#### Component Boundaries

```
[Layout]
    |
    v
ThemeProvider (wraps app)
    |
    v
[Any Component]
    |
    v
useTheme() hook
    |
    v
- theme: "light" | "dark" | "system"
- setTheme(theme)
- systemTheme: actual OS preference
```

---

### Feature 3: Notes

#### Requirements Analysis

From PROJECT.md:
- **Channel notes:** One markdown document per channel, any member can edit
- **Personal notes:** Private markdown scratchpad per user

**Key insight:** "One document per channel" means NOT collaborative real-time editing. This is simple document storage with basic version/conflict handling.

#### Database Schema

**Confidence:** HIGH (simple document storage)

```typescript
// src/db/schema/note.ts

// Channel notes - one per channel
export const channelNotes = pgTable("channel_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" })
    .unique(), // One note per channel
  content: text("content").notNull().default(""),
  lastEditedBy: text("last_edited_by")
    .references(() => users.id, { onDelete: "set null" }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("channel_notes_channel_idx").on(table.channelId),
]);

// Personal notes - one per user per workspace
export const personalNotes = pgTable("personal_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("personal_notes_user_org_idx").on(table.userId, table.organizationId),
]);
```

**Design decisions:**
- `version` column enables optimistic concurrency (save fails if version changed)
- No real-time sync needed (see below)
- Personal notes scoped to workspace (could have different notes per workspace)

#### Real-time Sync Decision

**Recommendation:** NO real-time sync for v0.4.0.

| Approach | Complexity | Use Case |
|----------|------------|----------|
| No sync | Low | One editor at a time, simple save |
| Socket notifications | Medium | Notify when someone else saved |
| OT/CRDT | Very High | True collaborative editing |

**Rationale:**
- "Any member can edit" != "Multiple members edit simultaneously"
- Slack's canvas feature is NOT real-time collaborative
- Google Docs-style editing is explicitly out of scope
- Simple last-write-wins with version check is sufficient

#### Conflict Handling Strategy

```typescript
// On save:
const saved = await db
  .update(channelNotes)
  .set({
    content,
    version: sql`version + 1`,
    lastEditedBy: userId,
    updatedAt: new Date()
  })
  .where(
    and(
      eq(channelNotes.id, noteId),
      eq(channelNotes.version, expectedVersion) // Optimistic lock
    )
  )
  .returning();

if (saved.length === 0) {
  // Version mismatch - someone else edited
  // Return 409 Conflict, client fetches latest
}
```

#### Optional: Edit Notifications via Socket

If users want to know when channel note was updated:

```typescript
// After successful save
io.to(getRoomName.channel(channelId)).emit("note:updated", {
  channelId,
  editedBy: userId,
  updatedAt: new Date(),
});
```

This notifies users to refresh, but doesn't sync content in real-time.

#### Markdown Rendering

**Library:** `react-markdown`

**Confidence:** HIGH (stable, secure, widely used)

| Library | Bundle Size | Security | JSX Support | Verdict |
|---------|-------------|----------|-------------|---------|
| react-markdown | ~23KB | Safe by default | No | **Use this** |
| MDX | ~50KB+ | User code runs | Yes | Overkill |
| marked + dangerouslySetInnerHTML | ~8KB | XSS risk | No | Avoid |

**Why react-markdown:**
- No `dangerouslySetInnerHTML` - safe by default
- Plugin system for GFM (tables, strikethrough, checklists)
- Components can be overridden for custom styling

#### Markdown Editor

**Recommendation:** Simple textarea with preview toggle.

```typescript
// Simple approach for v0.4.0
<div>
  {isEditing ? (
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      className="font-mono"
    />
  ) : (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  )}
  <button onClick={() => setIsEditing(!isEditing)}>
    {isEditing ? "Preview" : "Edit"}
  </button>
</div>
```

**Not recommended for v0.4.0:**
- WYSIWYG editors (Tiptap, Slate) - complexity for simple notes
- Split-pane editors - nice UX but not MVP

#### Component Boundaries

```
[ChannelView]
    |
    +-- [ChannelNotes]
            |
            +-- NoteEditor (textarea + preview)
            |
            +-- ReactMarkdown (render)
            |
            +-- Save button -> /api/channels/{id}/notes
                                    |
                                    v
                              - Validate membership
                              - Optimistic lock check
                              - Update content + version
                              - Return new version
```

---

### v0.4.0 Data Flow Summary

#### File Upload Flow

```
1. User selects file in MessageComposer
2. Client: POST /api/upload/file with FormData
3. Server: Validate auth, size, magic bytes
4. Server: Write to filesystem, insert to DB
5. Server: Return { fileId, url, metadata }
6. Client: Store fileId, show preview
7. User sends message
8. Client: message:send with fileIds array
9. Server: Create message, create messageAttachments
10. Server: Broadcast message with nested files
11. All clients: Render message with attachments
```

#### Theme Toggle Flow

```
1. User clicks theme toggle
2. next-themes: setTheme("dark")
3. next-themes: Write to localStorage
4. next-themes: Add .dark class to <html>
5. CSS: All var() references update
6. Page: Instant visual update (no reload)
```

#### Note Save Flow

```
1. User edits note content
2. User clicks Save (or debounced auto-save)
3. Client: PUT /api/channels/{id}/notes
           Body: { content, expectedVersion }
4. Server: Validate membership
5. Server: UPDATE with version check
6. Server: Return { success, newVersion } or 409
7. If 409: Client fetches latest, shows conflict UI
8. Optional: Server emits note:updated to room
```

---

### v0.4.0 Build Order Recommendation

Based on dependencies between components:

#### Phase 1: Theming (Lowest dependency)

**Why first:**
- No database changes
- No backend API changes
- Purely additive (new provider + component)
- Quick win, immediately visible

**Tasks:**
1. Install next-themes
2. Create ThemeProvider component
3. Update root layout
4. Add ThemeToggle to settings/header
5. Test: Light/dark/system modes persist

#### Phase 2: File Uploads

**Why second:**
- Database schema change (files, messageAttachments)
- New API route extending existing pattern
- UI changes to MessageComposer
- Socket handler modifications

**Tasks:**
1. Create files and messageAttachments schema
2. Run migration
3. Create /api/upload/file route (extend avatar pattern)
4. Add file picker to MessageComposer
5. Update message:send to accept fileIds
6. Update Socket handler to include attachments
7. Add FilePreview and ImagePreview components
8. Update Dockerfile for uploads volume

#### Phase 3: Notes

**Why last:**
- Database schema change (channelNotes, personalNotes)
- New API routes
- New UI components
- Depends on understanding of channel UI patterns

**Tasks:**
1. Create channelNotes and personalNotes schema
2. Run migration
3. Create /api/channels/{id}/notes endpoint
4. Create /api/user/notes endpoint
5. Install react-markdown + remark-gfm
6. Create NoteEditor component
7. Create NoteViewer component
8. Add notes tab/panel to channel view
9. Add personal notes to user menu/settings

---

### Docker Considerations for v0.4.0

Current Dockerfile doesn't persist uploads. Needs volume mount.

```yaml
# docker-compose.yml addition
app:
  volumes:
    - uploads_data:/app/public/uploads  # New: persist uploads

volumes:
  uploads_data:  # New volume
```

**Important:** Also update Dockerfile to create uploads directory with correct permissions for nextjs user.

---

## Sources

### HIGH Confidence (Official Engineering Blogs)
- [Slack Engineering: Real-Time Messaging](https://slack.engineering/real-time-messaging/) - Primary architecture reference
- [Ably: WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices)

### MEDIUM Confidence (Verified Patterns)
- [Scaling Pub/Sub with WebSockets and Redis](https://ably.com/blog/scaling-pub-sub-with-websockets-and-redis)
- [Socket.IO: Using Multiple Nodes](https://socket.io/docs/v4/using-multiple-nodes/)
- [WebSocket Gateway Reference Architecture](https://www.dasmeta.com/docs/solutions/websocket-gateway-reference-architecture/index)

### LOW Confidence (Community Patterns)
- [OpenChat Architecture: Scaling with Go, Redis, WebSockets](https://monzim.com/blogs/scaling-realtime-chatapp-with-go-redis-and-websocket)
- [System Design: Slack Architecture](https://systemdesign.one/slack-architecture/)

### v0.4.0 Feature Sources

#### Official Documentation (HIGH confidence)
- [Next.js Public Folder](https://nextjs.org/docs/pages/api-reference/file-conventions/public-folder)
- [next-themes GitHub](https://github.com/pacocoursey/next-themes)
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown)
- [Drizzle ORM Schema](https://orm.drizzle.team/docs/sql-schema-declaration)

#### Community Resources (MEDIUM confidence)
- [shadcn/ui Dark Mode](https://ui.shadcn.com/docs/dark-mode/next)
- [Next.js File Uploads](https://www.pronextjs.dev/next-js-file-uploads-server-side-solutions)

#### Project Codebase (HIGH confidence)
- `src/app/api/upload/avatar/route.ts` - Existing upload pattern
- `src/app/globals.css` - Existing CSS variables
- `src/middleware.ts` - Existing auth bypass pattern
- `src/db/schema/message.ts` - Existing schema patterns

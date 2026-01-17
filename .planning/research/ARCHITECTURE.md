# Architecture Patterns

**Domain:** Self-hosted real-time team chat platform (Slack-like)
**Researched:** 2026-01-17
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

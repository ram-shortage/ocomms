---
phase: 03-real-time-messaging
plan: 01
subsystem: websocket-infrastructure
tags: [socket.io, redis, websocket, real-time]

dependency_graph:
  requires:
    - 01-foundation (auth system)
    - 02-channels-dms (channel and conversation schemas)
  provides:
    - Custom server with Socket.IO
    - Redis adapter for horizontal scaling
    - Auth middleware for WebSocket connections
    - Room management utilities
    - Client socket hook
  affects:
    - 03-02 (message handlers will use this infrastructure)
    - 03-03 (presence will use this infrastructure)

tech_stack:
  added:
    - socket.io@4.8.3
    - socket.io-client@4.8.3
    - ioredis@5.9.2
    - "@socket.io/redis-adapter@8.3.0"
  patterns:
    - Custom Next.js server
    - Socket.IO middleware authentication
    - Room-based message routing
    - Graceful Redis fallback

key_files:
  created:
    - src/server/index.ts
    - src/server/redis.ts
    - src/server/socket/index.ts
    - src/server/socket/adapter.ts
    - src/server/socket/middleware/auth.ts
    - src/server/socket/rooms.ts
    - src/lib/socket-client.ts
    - src/lib/socket-events.ts
    - tsconfig.server.json
  modified:
    - package.json

decisions:
  - id: redis-graceful-fallback
    decision: "Graceful fallback to in-memory adapter when Redis unavailable"
    rationale: "Local development works without Redis; production gets scaling"
  - id: cookie-based-auth
    decision: "Session validation via better-auth cookies in handshake"
    rationale: "Consistent auth with HTTP routes, no separate token system"
  - id: room-naming
    decision: "Prefixed room names (channel:, dm:, workspace:, user:)"
    rationale: "Clear namespace prevents collisions, enables room type identification"

metrics:
  duration: 5 min
  completed: 2026-01-17
---

# Phase 3 Plan 1: WebSocket Infrastructure Summary

Socket.IO custom server with Redis pub/sub adapter, better-auth session middleware, and room management for channels/DMs.

## What Was Built

### Custom Server Entry Point (src/server/index.ts)

- HTTP server shared between Next.js and Socket.IO
- CORS configured from NEXT_PUBLIC_APP_URL
- Connection state recovery (2 min duration)
- Redis adapter attached when available, in-memory fallback otherwise

### Redis Integration (src/server/redis.ts, src/server/socket/adapter.ts)

- Redis client factory from REDIS_URL env var
- Pub/sub adapter with separate pub/sub clients (required for Redis)
- 5-second connection timeout with graceful error handling
- Logs warning and continues with in-memory adapter if Redis unavailable

### Authentication Middleware (src/server/socket/middleware/auth.ts)

- Extracts cookies from WebSocket handshake headers
- Validates session using `auth.api.getSession()`
- Attaches userId and user object to socket.data
- Rejects connection with error if session invalid

### Room Management (src/server/socket/rooms.ts)

- Room naming conventions: `channel:{id}`, `dm:{id}`, `workspace:{id}`, `user:{id}`
- `joinUserRooms()` queries channel memberships and conversation participants
- Joins socket to all authorized rooms on connection
- Dynamic `room:join` and `room:leave` events for runtime membership changes

### Client Hook (src/lib/socket-client.ts)

- Singleton socket instance with `getSocket()`
- `useSocket()` hook connects on mount, disconnects on unmount
- Configured with `withCredentials: true` for cookie authentication
- Reconnection settings: 10 attempts, 1-5s exponential backoff

### Event Types (src/lib/socket-events.ts)

- TypeScript interfaces for ServerToClientEvents and ClientToServerEvents
- SocketData interface for type-safe socket.data access
- Message type with all fields for real-time message events

## Verification Results

| Check | Status |
|-------|--------|
| `npm run dev` starts custom server | Pass |
| Socket.IO ready at /socket.io/ | Pass |
| TypeScript compiles without errors | Pass |
| Redis adapter connects when REDIS_URL set | Pass (logs "Redis adapter connected") |
| Graceful fallback when Redis unavailable | Pass (logs warning, uses in-memory) |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### Package.json Script Changes

```json
"dev": "tsx --watch src/server/index.ts"
"start": "node dist/server/index.js"
"build:server": "tsc -p tsconfig.server.json"
```

### tsconfig.server.json

Created separate config for server-side compilation with NodeNext module resolution and dist output directory.

### Next.js Deprecation Warning

```
The "middleware" file convention is deprecated. Please use "proxy" instead.
```

This is a Next.js 16 change unrelated to WebSocket implementation. Will be addressed in a future plan if needed.

## Next Phase Readiness

Ready for 03-02 (Message Sending & Persistence):
- Socket.IO server running and accepting authenticated connections
- Room management in place for channel/DM message routing
- Event types defined for message:new, message:deleted events
- Client hook ready for use in message UI components

**Dependencies satisfied:**
- Channel and conversation schemas exist from Phase 2
- Auth middleware validates sessions
- Room joining queries channel_members and conversation_participants tables

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 6d03242 | feat | Add WebSocket infrastructure with custom server |
| 431b768 | feat | Add Socket.IO auth, rooms, and client setup |

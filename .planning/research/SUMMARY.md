# Research Summary

**Project:** OComms - Self-Hosted Team Chat Platform
**Researched:** 2026-01-17
**Overall Confidence:** HIGH

---

## Executive Summary

OComms enters a mature market with well-established patterns. The recommended approach: **TypeScript everywhere, PostgreSQL + Redis architecture, React ecosystem for all clients**. The first milestone "Full Conversation" covers all table stakes features. Success depends on execution quality, not innovation.

**Key insight:** At 500 concurrent users, you can use simplified enterprise patterns. No Kubernetes, no Elasticsearch, no distributed databases needed yet. Single-server deployment with Docker Compose is the right starting point.

---

## Stack Decisions (HIGH confidence)

| Layer | Choice | Why |
|-------|--------|-----|
| **Backend** | Node.js 22 + Hono + Socket.IO (uWebSockets adapter) | TypeScript everywhere, 4x faster than Express, proven WebSocket abstraction |
| **Database** | PostgreSQL 17 + Valkey (Redis fork) | ACID for messages, BSD license for self-hosted, pub/sub for real-time |
| **ORM** | Drizzle ORM | 7KB vs Prisma's 500KB, no code generation, SQL-first |
| **Search** | Meilisearch | Single binary, MIT license, sub-50ms latency |
| **Web** | React 19 + Vite + TanStack Query + Zustand | Compiler optimization, ecosystem maturity |
| **Mobile** | React Native + Expo | Code sharing with web, 20x larger talent pool than Dart |
| **Desktop** | Tauri 2.x | 3MB vs Electron's 100MB, 30MB RAM vs 200MB |
| **Deploy** | Docker Compose | Single-command deployment, no K8s complexity at this scale |

**What NOT to use:** Electron (too heavy), Prisma (too slow), MongoDB (wrong fit), Kubernetes (overkill), Flutter (no code sharing).

---

## Architecture Decisions (HIGH confidence)

### Core Pattern
```
HTTP API (commands/persistence) → PostgreSQL → Redis (publish)
                                                    ↓
                                      WebSocket Gateway (push to clients)
```

### Key Architectural Principles

1. **HTTP for writes, WebSocket for reads** - Messages sent via REST, delivered via WebSocket
2. **Ephemeral vs Persistent split** - Typing/presence in Redis with TTL, messages in PostgreSQL
3. **Pub/sub from day one** - Every WebSocket gateway subscribes to Redis, enables horizontal scaling
4. **Server-assigned ordering** - Sequence numbers per conversation, not client timestamps

### Component Boundaries

- **HTTP API:** Auth, CRUD, file uploads, search, business logic
- **WebSocket Gateway:** Connection lifecycle, event delivery, room subscriptions
- **Redis:** Inter-instance messaging, presence cache, typing indicators, unread cache
- **PostgreSQL:** All persistent data, ACID transactions, complex queries

---

## Feature Prioritization (HIGH confidence)

### Table Stakes (Must ship in v1.0)
- Channels (public/private) + DMs
- Real-time messaging with threading
- @mentions with notifications
- Basic search (full-text)
- Presence (online/away/offline)
- Unread management

### Differentiators for Self-Hosted
- Zero external dependencies (air-gapped deployment possible)
- Simple deployment (one command)
- Power search with modifiers (`in:`, `from:`, `before:`, `after:`)
- Resource efficiency (run on modest hardware)

### Anti-Features (Do NOT build in v1.0)
- AI summaries/Q&A (breaks self-hosted value prop)
- Video/audio calls (massive complexity)
- Workflow Builder (enterprise scope creep)
- Nested threading (no major platform does this)
- Read receipts (privacy concerns, complexity)

---

## Critical Pitfalls to Prevent

| Pitfall | Phase | Prevention |
|---------|-------|------------|
| **WebSocket without pub/sub** | Foundation | Redis pub/sub architecture from day one |
| **Message ordering chaos** | Messages | Server-assigned sequence numbers per conversation |
| **Thread complexity explosion** | Messages | Materialized path, single-level threading only |
| **Unread counts that lie** | Unreads | Server-side read horizon, not client state |
| **Self-hosted data loss** | Deployment | Volume mount validation, startup checks |

### Self-Hosted Specific Risks
- Docker restart data loss → Named volumes + startup validation
- Push notification limits → Self-hosted gateway (ntfy/Gotify) or BYOK Firebase
- SSO lockout → Emergency local admin account always available
- Storage exhaustion → Quota enforcement, clear documentation

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation
**Build:** Database schema, core API, authentication, workspace/member/channel primitives
- Uses: PostgreSQL, Drizzle ORM, Hono
- Addresses: Core data model, auth with escape hatches
- Avoids: Pitfall 5 (data loss), Pitfall 9 (auth lockout), Pitfall 14 (naming collisions)

### Phase 2: Real-Time Core
**Build:** WebSocket gateway, Redis pub/sub, message delivery, basic presence
- Uses: Socket.IO + uWebSockets adapter, Valkey
- Addresses: Real-time messaging foundation
- Avoids: Pitfall 1 (no pub/sub), Pitfall 2 (ordering chaos)

### Phase 3: Threading & Conversations
**Build:** Thread model, mentions, reactions, channel metadata
- Addresses: Threading (HIGH complexity table stakes)
- Avoids: Pitfall 3 (thread complexity) - use materialized path

### Phase 4: Attention Management
**Build:** Unreads, DND, notification preferences, drafts
- Addresses: Multi-device sync, notification routing
- Avoids: Pitfall 4 (lying unreads), Pitfall 8 (notification chaos)

### Phase 5: Search
**Build:** Full-text search, query modifiers, indexing pipeline
- Uses: Meilisearch (or PostgreSQL FTS initially)
- Addresses: Power search differentiator
- Avoids: Pitfall 7 (slow/missing search)

### Phase 6: Self-Hosted Packaging
**Build:** Docker Compose config, health checks, documentation, deployment validation
- Addresses: Single-command deployment promise
- Avoids: Pitfall 5 (data loss), Pitfall 15 (storage assumptions)

### Phase Ordering Rationale

1. **Foundation before real-time:** API patterns inform WebSocket design, simpler debugging
2. **Real-time before threading:** Threading depends on message delivery working
3. **Threading before unreads:** Unread counts need to understand thread membership
4. **Search after core features:** Can use PostgreSQL FTS initially, upgrade later
5. **Packaging last:** Need working product before deployment optimization

### Research Flags for Later Phases

- **Mobile apps:** May need dedicated research on React Native + Expo for chat UX
- **Push notifications:** Self-hosted push gateway selection (ntfy vs Gotify vs custom)
- **SSO integration:** authentik vs Keycloak for enterprise customers

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Backend stack | HIGH | Node.js + Hono + Socket.IO is proven pattern |
| Database layer | HIGH | PostgreSQL + Redis is industry standard |
| Frontend stack | HIGH | React ecosystem dominance |
| Architecture patterns | HIGH | Verified against Slack engineering blog |
| Feature priorities | HIGH | Cross-verified against Slack, Mattermost, Rocket.Chat |
| Pitfall identification | MEDIUM-HIGH | Based on multiple sources, some self-hosted specific |
| Desktop (Tauri) | MEDIUM | Newer technology, watch for WebView quirks |
| Phase structure | MEDIUM | Derived from dependencies, may need adjustment |

---

## Open Questions (Deferred to Phase-Specific Research)

1. **Database schema design** - Exact table structure, indexes, partitioning strategy
2. **WebSocket event protocol** - Message format, versioning, error handling
3. **File upload strategy** - Chunking for large files, storage backend abstraction
4. **Mobile-specific considerations** - Background connections, battery optimization
5. **Push notification gateway** - Which self-hosted solution to recommend

---

## Sources

Research drew from:
- Official documentation (Node.js, PostgreSQL, React, Socket.IO, Meilisearch)
- Engineering blogs (Slack, Ably, Stream)
- Competitor analysis (Mattermost, Rocket.Chat, Zulip)
- System design resources (verified patterns)
- Self-hosted community (common deployment issues)

See individual research files for detailed citations:
- `STACK.md` - Technology choices with versions
- `FEATURES.md` - Feature landscape and prioritization
- `ARCHITECTURE.md` - System design patterns
- `PITFALLS.md` - Domain-specific mistakes to avoid

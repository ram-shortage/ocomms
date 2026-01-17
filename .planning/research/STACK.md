# Technology Stack

**Project:** OComms - Self-Hosted Real-Time Team Chat Platform
**Researched:** 2026-01-17
**Target Scale:** 500+ concurrent users per workspace
**Deployment Model:** Self-hosted, single-command deployment

---

## Executive Summary

For a self-hosted Slack-like platform at 500+ concurrent user scale, the recommended stack prioritizes:
- **TypeScript everywhere** for type safety across web, mobile, desktop, and backend
- **PostgreSQL** for primary data (proven, ACID-compliant, excellent JSON support)
- **Redis/Valkey** for real-time pub/sub and caching
- **Socket.IO** for WebSocket abstraction (with uWebSockets.js backend for performance)
- **React** for web/desktop (ecosystem maturity), **React Native** for mobile (code sharing)
- **Docker Compose** for self-hosted deployment (no Kubernetes complexity)

**Confidence Level:** HIGH - Recommendations based on verified 2025 documentation, benchmarks, and production patterns from similar systems.

---

## Recommended Stack

### Backend Runtime & Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Node.js** | 22.x LTS | Runtime | Active LTS until Apr 2027. 30% faster startup than v20. Built-in WebSocket client, native TypeScript support (experimental). V8 12.4 with Maglev compiler. |
| **Hono** | 4.x | HTTP Framework | 4x faster than Express, TypeScript-first, ~14KB minified. Built-in CORS, auth middleware, security headers. Runs on Node, Bun, Deno (future flexibility). |
| **Socket.IO** | 4.8.x | Real-time | Proven at scale (Slack alternatives use it). Automatic reconnection, fallback to long-polling. **Use uWebSockets.js adapter** for 5x connection capacity and lower memory. |

**Why Hono over Express:**
- Express is legacy (weakly typed, Node http module coupling)
- Hono has Express-like API but modern internals
- Built-in middleware reduces dependency bloat
- Source: [Hono vs Express 2025](https://khmercoder.com/@stoic/articles/25847997)

**Why Socket.IO over raw WebSockets:**
- Handles reconnection, room management, namespaces out-of-box
- Can upgrade to uWebSockets.js backend for 10x performance boost
- Ecosystem maturity matters for production (debugging tools, documentation)
- Source: [Socket.IO 4.4.0 uWebSockets support](https://socket.io/blog/socket-io-4-4-0/)

### Database Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | 17.x | Primary database | #1 developer database (55% usage in 2025 surveys). JSON_TABLE for flexible schemas. 2x COPY performance. Mature replication for HA. |
| **Valkey** | 8.x | Cache + Pub/Sub | BSD-licensed Redis fork (Linux Foundation backed). WebSocket horizontal scaling via pub/sub. Session storage, rate limiting. |

**Why PostgreSQL over NoSQL (ScyllaDB/Cassandra):**
- 500 concurrent users is NOT web-scale - PostgreSQL handles this trivially
- ACID compliance critical for chat (messages can't be lost)
- Simpler operations (no distributed system complexity)
- Rich querying for search, analytics, export
- ScyllaDB is overkill until 100K+ concurrent users
- Source: [PostgreSQL 17 Features](https://www.postgresql.org/about/news/postgresql-17-released-2936/)

**Why Valkey over Redis:**
- Identical API (drop-in replacement)
- BSD license vs Redis's SSPL (self-hosted friendly)
- 75% of Redis users testing/adopting Valkey
- Linux Foundation governance ensures open-source future
- Source: [Valkey vs Redis 2025](https://www.dragonflydb.io/guides/valkey-vs-redis)

### ORM & Database Access

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Drizzle ORM** | 0.40.x | Database ORM | SQL-first, 7KB bundle, zero cold-start overhead. 14x faster complex queries than Prisma. No code generation step. |
| **drizzle-kit** | 0.30.x | Migrations | Type-safe migrations, introspection support |

**Why Drizzle over Prisma:**
- Drizzle: ~7KB vs Prisma: ~500KB+ (Rust binary)
- No `prisma generate` step - instant type updates
- SQL-like syntax = team already knows it
- Better for self-hosted (no binary dependencies)
- Prisma trades performance for DX; Drizzle gives both
- Source: [Drizzle vs Prisma 2025](https://www.bytebase.com/blog/drizzle-vs-prisma/)

### Search Engine

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Meilisearch** | 1.12.x | Full-text search | Single binary, MIT license. Sub-50ms search latency. Typo-tolerant out-of-box. Docker-friendly self-hosted. |

**Why Meilisearch over alternatives:**
- **vs Elasticsearch:** 10x simpler ops, 80% of features at 20% cost
- **vs Typesense:** MIT license (vs AGPL), better dashboard UI, simpler config
- At 500 users, Meilisearch single-node is more than sufficient
- Source: [Meilisearch Comparison](https://www.meilisearch.com/docs/learn/resources/comparison_to_alternatives)

### File Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **MinIO** | Latest | Object storage | S3-compatible API. Single binary deployment. All AWS S3 SDKs work unchanged. |

**Self-hosted consideration:** MinIO community edition now source-only (no pre-built binaries). Build from source or use Docker image.

**Alternative:** Local filesystem with S3-compatible wrapper for simplest deployments.

Source: [MinIO Self-Hosting Guide](https://selfhostschool.com/minio-self-hosted-s3-storage-guide/)

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Built-in auth** | - | Core authentication | Email/password, magic links. JWT + refresh tokens. Simpler for self-hosted (no external deps). |
| **authentik** | 2024.x | SSO/SAML (optional) | Self-hosted IdP. SAML, OIDC, LDAP support. For enterprises needing SSO. |

**Why built-in over Auth0/Clerk:**
- Self-hosted requirement = no external SaaS dependencies
- Chat platform auth is straightforward (no complex OAuth flows initially)
- Add SSO layer via authentik for enterprise customers

**Why authentik over Keycloak:**
- Modern UI, easier to configure
- Python-based (simpler than Keycloak's Java stack)
- Full SAML/OIDC/LDAP support
- Source: [authentik](https://goauthentik.io/)

---

## Frontend Stack

### Web Application

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **React** | 19.x | UI Framework | 39.5% market share. React 19 Compiler = 25-40% fewer re-renders. Server Components stable. Massive ecosystem. |
| **Vite** | 6.x | Build tool | Near-instant HMR. ES modules native. |
| **TanStack Query** | 5.x | Data fetching | Caching, optimistic updates, real-time sync |
| **Zustand** | 5.x | State management | Minimal API, TypeScript-first, no boilerplate |
| **Tailwind CSS** | 4.x | Styling | Utility-first, design system consistency |

**Why React over SolidJS/Svelte:**
- **SolidJS:** Faster runtime but tiny ecosystem, hard to hire
- **Svelte:** Excellent DX but smaller ecosystem, less battle-tested at scale
- React 19 closes performance gap with Compiler
- React Native code sharing for mobile
- Vast library ecosystem (chat UI components, emoji pickers, etc.)
- Source: [React 19 Features](https://react.dev/blog/2024/12/05/react-19)

### Desktop Application

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Tauri** | 2.x | Desktop wrapper | ~3MB vs Electron's ~100MB. 30MB RAM vs 200MB. Native WebView. iOS/Android support in 2.x. |

**Why Tauri over Electron:**
- 50x smaller installer
- 6x lower memory usage
- Rust backend for native system access
- Tauri 2.x: same codebase targets iOS/Android too
- Source: [Tauri vs Electron 2025](https://codeology.co.nz/articles/tauri-vs-electron-2025-desktop-development.html)

**Trade-off:** WebView fragmentation across platforms (Safari bugs on macOS, Edge bugs on Windows). Mitigate with thorough cross-platform testing.

### Mobile Application

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **React Native** | 0.76.x | iOS + Android | New Architecture (Fabric) stable. Code sharing with React web. 20:1 JS vs Dart developer ratio. |
| **Expo** | 52.x | Development platform | Managed workflow, OTA updates, easier native modules |

**Why React Native over Flutter:**
- Share business logic, types, utilities with web app
- JavaScript talent pool 20x larger than Dart
- Expo simplifies native builds, push notifications
- React Native 0.76 New Architecture closes Flutter performance gap
- Source: [React Native vs Flutter 2025](https://www.thedroidsonroids.com/blog/flutter-vs-react-native-comparison)

---

## Monorepo & Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Turborepo** | 2.x | Build orchestration | Incremental builds, remote caching, task pipelines. Vercel-backed (active development). |
| **pnpm** | 9.x | Package manager | 2x faster than npm, strict dependency isolation, workspace support |
| **TypeScript** | 5.7.x | Language | Type safety across all packages. Project references for monorepo. |
| **Vitest** | 2.x | Testing | Vite-native, faster than Jest, TypeScript-first |
| **Biome** | 1.x | Linting/formatting | 25x faster than ESLint+Prettier, single tool |

**Monorepo structure:**
```
ocomms/
  apps/
    api/          # Hono backend
    web/          # React web app
    desktop/      # Tauri wrapper
    mobile/       # React Native app
  packages/
    shared/       # Types, utilities, validation
    ui/           # Shared React components
    db/           # Drizzle schema, migrations
```

Source: [Turborepo Monorepo 2025](https://jeffbruchado.com.br/en/blog/javascript-monorepos-turborepo-nx-2025)

---

## Infrastructure & Deployment

### Self-Hosted Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Docker Compose** | 3.x | Orchestration | Single-command deployment: `docker compose up`. No Kubernetes complexity for 500 users. |
| **Caddy** | 2.x | Reverse proxy | Automatic HTTPS, simple config, HTTP/3 support |
| **Postgres (container)** | 17 | Database | Official image, persistent volumes |
| **Valkey (container)** | 8 | Cache/Pub-Sub | Official image |
| **Meilisearch (container)** | 1.12 | Search | Official image |
| **MinIO (container)** | Latest | File storage | S3-compatible, persistent volumes |

**Why Docker Compose over Kubernetes:**
- 500 users = single server can handle it
- `docker compose up -d` is the "single command" promise
- Kubernetes adds operational complexity without benefit at this scale
- Can migrate to K8s later if needed (containers are portable)

**Scaling path:**
1. Single server with Docker Compose (v1.0)
2. Separate DB server when needed
3. Kubernetes/Docker Swarm only at 10K+ concurrent users

---

## What NOT to Use (and Why)

| Technology | Why Not |
|------------|---------|
| **Elixir/Phoenix** | Excellent for real-time but team would need to learn new language. Node.js + Socket.IO + uWebSockets achieves similar scale with familiar stack. |
| **MongoDB** | Poor fit for relational chat data (workspaces, channels, threads). PostgreSQL's JSON support handles flexible schemas. |
| **ScyllaDB/Cassandra** | Massive overkill at 500 users. Adds operational complexity. PostgreSQL sufficient until 100K+ users. |
| **Kubernetes** | Unnecessary complexity for target scale. Docker Compose achieves single-command deployment. |
| **Electron** | 100MB+ installer, 200MB+ RAM per instance. Tauri is 50x smaller, 6x less memory. |
| **Flutter** | Dart developer pool 20x smaller than JavaScript. Can't share code with React web app. |
| **Prisma** | 500KB binary, cold start issues, `prisma generate` step. Drizzle is lighter and faster. |
| **Express.js** | Legacy, weakly typed, requires many middleware packages. Hono is modern Express. |
| **Redis (SSPL)** | License concerns for self-hosted. Valkey is BSD-licensed, API-compatible. |
| **Elasticsearch** | Operational complexity for search. Meilisearch is simpler for this scale. |
| **SolidJS/Svelte** | Smaller ecosystems, harder to hire, less code sharing with mobile. |
| **Next.js** | Server-side rendering unnecessary for real-time chat SPA. Adds complexity. |

---

## Version Summary

### Core Versions (as of Jan 2026)

```bash
# Runtime
node: 22.x  # LTS until Apr 2027

# Backend
hono: ^4.0.0
socket.io: ^4.8.0
drizzle-orm: ^0.40.0
ioredis: ^5.4.0

# Database
postgresql: 17
valkey: 8.x
meilisearch: 1.12.x

# Frontend
react: ^19.0.0
vite: ^6.0.0
@tanstack/react-query: ^5.0.0
zustand: ^5.0.0
tailwindcss: ^4.0.0

# Mobile
react-native: 0.76.x
expo: ~52.0.0

# Desktop
tauri: ^2.0.0

# Tooling
typescript: ^5.7.0
turborepo: ^2.0.0
pnpm: ^9.0.0
vitest: ^2.0.0
biome: ^1.9.0
```

---

## Installation

```bash
# Create project with Turborepo
pnpm dlx create-turbo@latest ocomms

# Core backend dependencies
pnpm add -F api hono socket.io drizzle-orm postgres ioredis meilisearch

# Dev dependencies
pnpm add -D -F api drizzle-kit @types/node vitest

# Web frontend
pnpm add -F web react react-dom @tanstack/react-query zustand
pnpm add -D -F web vite @vitejs/plugin-react tailwindcss

# Shared types
pnpm add -F shared zod

# Docker setup for self-hosting
# docker-compose.yml provides: postgres, valkey, meilisearch, minio, caddy
```

---

## Sources

### High Confidence (Official Documentation)
- [Node.js 22 LTS Release](https://nodejs.org/en/blog/announcements/v22-release-announce)
- [PostgreSQL 17 Released](https://www.postgresql.org/about/news/postgresql-17-released-2936/)
- [React 19 Release](https://react.dev/blog/2024/12/05/react-19)
- [Valkey Official](https://valkey.io/)
- [Meilisearch Documentation](https://www.meilisearch.com/docs/learn/resources/comparison_to_alternatives)
- [Turborepo Documentation](https://turbo.build/)
- [Tauri 2.0](https://tauri.app/)
- [Socket.IO 4.4.0 uWebSockets](https://socket.io/blog/socket-io-4-4-0/)

### Medium Confidence (Verified Benchmarks)
- [Drizzle vs Prisma](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Tauri vs Electron Performance](https://www.levminer.com/blog/tauri-vs-electron)
- [React Native vs Flutter 2025](https://www.thedroidsonroids.com/blog/flutter-vs-react-native-comparison)
- [Hono vs Express](https://khmercoder.com/@stoic/articles/25847997)
- [Socket.IO vs uWebSockets Benchmarks](https://github.com/ezioda004/benchmark-socketio-uwebsockets)
- [Valkey vs Redis](https://www.dragonflydb.io/guides/valkey-vs-redis)
- [WebSocket Scaling with Redis Pub/Sub](https://ably.com/blog/scaling-pub-sub-with-websockets-and-redis)

### Additional References
- [Monorepo Turborepo Guide](https://jeffbruchado.com.br/en/blog/javascript-monorepos-turborepo-nx-2025)
- [MinIO Self-Hosting](https://selfhostschool.com/minio-self-hosted-s3-storage-guide/)
- [authentik SSO](https://goauthentik.io/)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Backend (Node/Hono/Socket.IO) | HIGH | Verified with official docs, benchmarks, production patterns |
| Database (PostgreSQL/Valkey) | HIGH | Industry standard, extensive documentation |
| ORM (Drizzle) | HIGH | Benchmarks verified, growing adoption |
| Search (Meilisearch) | HIGH | Official docs, clear comparison data |
| Frontend (React 19) | HIGH | Official release, widespread adoption |
| Desktop (Tauri 2.x) | MEDIUM | Newer, but benchmarks verified. Watch for WebView quirks. |
| Mobile (React Native) | HIGH | New Architecture stable, Expo mature |
| Self-hosted infra | HIGH | Docker Compose is proven pattern |

---

## Roadmap Implications

1. **Phase 1 (Foundation):** Set up monorepo, database schema, authentication, basic API
2. **Phase 2 (Real-time):** WebSocket infrastructure, presence, typing indicators
3. **Phase 3 (Core Features):** Messages, channels, threads, reactions
4. **Phase 4 (Search):** Meilisearch integration, indexing pipeline
5. **Phase 5 (Desktop/Mobile):** Tauri wrapper, React Native app
6. **Phase 6 (Self-hosted):** Docker Compose packaging, documentation

**Key architectural decisions to lock early:**
- Database schema (migrations are painful)
- WebSocket event structure (clients depend on it)
- Monorepo structure (refactoring is expensive)

# OComms

## What This Is

OComms is a self-hosted team communication platform - a Slack-like experience that organizations can run on their own infrastructure. It provides real-time messaging, channels, threads, mentions, search, and presence features while giving teams full control over their data. Available as an installable PWA with offline support and push notifications for mobile access.

## Core Value

**Data sovereignty**: Complete control over communication data, no third-party dependencies

---

## Current State

**Version:** v0.3.0 (Mobile & Polish) - Shipped 2026-01-19

Delivered PWA with offline messaging, push notifications, mobile-first navigation, and admin tools.

**Tech Stack:**
- Next.js 15 with App Router
- TypeScript (~17,900 LOC)
- PostgreSQL with Drizzle ORM (SSL encrypted)
- Socket.IO with Redis pub-sub
- Docker Compose deployment (HTTPS with Let's Encrypt)
- Serwist/Workbox for service worker
- Dexie.js for IndexedDB
- Web Push API

**What's Working:**
- Real-time messaging in channels and DMs
- Public/private channels with membership
- Single-level message threading
- Emoji reactions with frimousse picker
- @user, @channel, @here mentions with notifications
- Unread counts and mark-as-read
- Full-text search with PostgreSQL FTS
- Presence (active/away/offline)
- Docker deployment with backup/restore
- Authorization validation on all socket handlers
- HTTPS with auto-renewing Let's Encrypt certificates
- Security headers (CSP, HSTS 1-year, X-Frame-Options, X-Content-Type-Options)
- Rate limiting on auth and message endpoints
- Password strength validation with zxcvbn
- Account lockout with progressive delays
- Audit logging for security events
- **v0.3.0:** Installable PWA with service worker caching
- **v0.3.0:** Offline message reading with 7-day IndexedDB cache
- **v0.3.0:** Offline send queue with optimistic UI and auto-sync
- **v0.3.0:** Push notifications for DMs and @mentions
- **v0.3.0:** Mobile bottom tab navigation with responsive layout
- **v0.3.0:** Admin UI (audit logs, data export)

## Target Users

Internal tool for organizations with 500+ concurrent users who need:
- Real-time team communication
- Full control over their data
- Self-hosting capability
- Web-first access (mobile/desktop web)

---

## Requirements

### Validated

Requirements shipped and working in production:

- **v0.1.0 - Full Conversation** (51 requirements)
  - AUTH-01 to AUTH-04: Email/password auth with sessions
  - WKSP-01 to WKSP-03: Workspace creation and invitations
  - MEMB-01 to MEMB-06: Member roles, profiles, avatars
  - CHAN-01 to CHAN-09: Channels, membership, pins
  - DM-01 to DM-03: Direct messages
  - MSG-01 to MSG-04: Real-time messaging
  - THRD-01 to THRD-04: Threading
  - NOTF-01 to NOTF-06: Mentions and notifications
  - SRCH-01 to SRCH-02: Full-text search
  - PRES-01 to PRES-02: Presence
  - UNRD-01 to UNRD-03: Unread management
  - REAC-01 to REAC-03: Emoji reactions
  - INFR-01 to INFR-05: Docker deployment, backup/restore

- **v0.2.0 - Security Hardening** (19 requirements)
  - AUTHZ-01 to AUTHZ-07: Socket.IO authorization validation
  - INTG-01 to INTG-03: Data integrity (sequences, FK constraints, export scoping)
  - VAL-01 to VAL-02: Input validation (file signatures, session validity)
  - SEC-01: HTTPS/SSL with Let's Encrypt auto-renewal
  - SEC-02: Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
  - SEC-03: Rate limiting on auth endpoints
  - SEC-04: Password strength validation with zxcvbn
  - SEC-05: Database connection SSL encryption
  - SEC-06: Audit logging for security events
  - SEC-07: Account lockout with progressive delays

- **v0.3.0 - Mobile & Polish** (38 requirements)
  - PWA-01 to PWA-06: Manifest, service worker, offline page, install prompt, iOS guidance
  - OFFL-01 to OFFL-07: IndexedDB cache, offline reading, send queue, status indicators, sync
  - PUSH-01 to PUSH-06: VAPID keys, subscription, DM/mention push, per-channel settings
  - MOBI-01 to MOBI-05: Bottom tabs, responsive layout, touch targets, pull-to-refresh, keyboard
  - UIPOL-01 to UIPOL-06: Navigation, logout, audit viewer, data export, docs, HSTS
  - SECFIX-01 to SECFIX-08: Mention scoping, fail-closed, atomic sequence, rate limiting

### Active

**v0.4.0 - Files, Theming & Notes**

- [ ] File uploads: any file type up to 25MB, attach to messages
- [ ] Image previews: inline display for image attachments
- [ ] File storage: local disk storage with secure access
- [ ] Dark mode: light/dark theme toggle with system preference detection
- [ ] Theme persistence: remember user's theme choice
- [ ] Channel notes: one markdown document per channel, any member can edit
- [ ] Personal notes: private markdown scratchpad per user

### Out of Scope

| Feature | Reason |
|---------|--------|
| AI summaries/Q&A | Breaks self-hosted value prop (external API dependencies) |
| Video/audio calls | Massive infrastructure complexity (WebRTC, TURN servers) |
| Workflow Builder | Enterprise scope creep |
| Shared channels | Multi-tenant complexity |
| Rich collaborative docs | Real-time co-editing complexity (Notion/Google Docs level) |
| Nested threading | Complexity trap, no major platform does this |
| Read receipts | Privacy concerns, complexity at scale |
| Mobile native apps | PWA provides mobile access; native apps not needed |
| Full offline mode | iOS 50MB storage limit, 7-day ITP eviction |
| Background sync iOS | Not supported by Safari |

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| better-auth for authentication | Best Next.js integration, organization plugin | Good |
| Socket.IO with Redis adapter | Horizontal scaling, graceful fallback | Good |
| Self-referencing parentId for threads | No separate threads table needed | Good |
| frimousse emoji picker | <5KB vs 50KB alternatives | Good |
| PostgreSQL native FTS | Data sovereignty over Meilisearch | Good |
| esbuild for server bundling | Fastest bundler, handles node externals | Good |
| vitest for unit testing | Fast, Vite-compatible, TypeScript-first | Good |
| zxcvbn for password strength | 400KB but dynamic import, best analysis | Good |
| In-memory rate limiting | Single-server appropriate, Redis for scaling | Good |
| Fire-and-forget audit logging | Never blocks request flow | Good |
| 5-min session validation cache | Balance security and performance | Good |
| Serwist for service worker | Maintained Workbox fork, Next.js App Router support | Good |
| Dexie.js for IndexedDB | React hooks, TypeScript support, compound indexes | Good |
| 7-day cache retention | Matches Safari ITP policy, reasonable storage | Good |
| VAPID keys in environment | Generated once, stored securely | Good |
| Double-permission pattern for push | In-app prompt before browser permission | Good |
| dvh units for mobile layout | Accounts for browser chrome and virtual keyboards | Good |

---

## Constraints

### Scale
- Support 500+ concurrent users per workspace
- Handle message bursts (all-hands announcements, incidents)
- Maintain responsiveness under load

### Real-time
- Instant message delivery via WebSockets
- Presence updates propagated immediately
- No polling-based fallbacks for core features

### Self-hosted
- Single-command deployment (`docker-compose up`)
- No external service dependencies for core features
- Reasonable hardware requirements

### Mobile/PWA
- Offline reading with 7-day cache
- Offline compose with automatic sync
- Push notifications require VAPID configuration

---

---
*Last updated: 2026-01-20 after starting v0.4.0 milestone*

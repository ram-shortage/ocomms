# OComms

## What This Is

OComms is a self-hosted team communication platform - a Slack-like experience that organizations can run on their own infrastructure. It provides real-time messaging, channels, threads, mentions, search, and presence features while giving teams full control over their data.

## Core Value

**Data sovereignty**: Complete control over communication data, no third-party dependencies

## Current Milestone: v0.3.0 Mobile & Polish

**Goal:** Complete UI gaps, add PWA support with offline capability and push notifications for mobile access.

**Target features:**
- UI polish: sidebar navigation, logout button, admin UIs (audit viewer, data export)
- PWA foundation: manifest, service worker, install prompt
- Mobile layout: bottom tab bar navigation, responsive design
- Offline support: 7-day message cache with IndexedDB, offline send queue, background sync
- Push notifications: Web Push API, subscription management, mentions/DM alerts
- Documentation: Complete USER-SETUP.md, increase HSTS max-age

---

## Current State

**Version:** v0.2.0 (Security Hardening) - Shipped 2026-01-18

Delivered production-ready security baseline with authorization fixes, encrypted transport, hardened authentication, and audit trail.

---

## Current State

**Tech Stack:**
- Next.js 15 with App Router
- TypeScript (~16,000 LOC)
- PostgreSQL with Drizzle ORM (SSL encrypted)
- Socket.IO with Redis pub-sub
- Docker Compose deployment (HTTPS with Let's Encrypt)

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
- **v0.2.0:** Authorization validation on all socket handlers
- **v0.2.0:** HTTPS with auto-renewing Let's Encrypt certificates
- **v0.2.0:** Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- **v0.2.0:** Rate limiting on auth endpoints
- **v0.2.0:** Password strength validation with zxcvbn
- **v0.2.0:** Account lockout with progressive delays
- **v0.2.0:** Audit logging for security events

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

### Active

**v0.3.0 - Mobile & Polish:**
- UI Polish: Sidebar navigation, logout button, admin UIs
- PWA: Manifest, service worker, install prompt
- Mobile: Bottom tab bar, responsive layout
- Offline: IndexedDB cache (7 days), send queue, background sync
- Push: Web Push API notifications for mentions/DMs
- Docs: USER-SETUP.md, HSTS hardening

### Out of Scope

| Feature | Reason |
|---------|--------|
| AI summaries/Q&A | Breaks self-hosted value prop (external API dependencies) |
| Video/audio calls | Massive infrastructure complexity (WebRTC, TURN servers) |
| Workflow Builder | Enterprise scope creep |
| Shared channels | Multi-tenant complexity |
| Canvas/Docs | Different product |
| Nested threading | Complexity trap, no major platform does this |
| Read receipts | Privacy concerns, complexity at scale |
| Mobile native apps | PWA provides mobile access; native apps not needed |

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

---

---
*Last updated: 2026-01-18 after v0.3.0 milestone planning*

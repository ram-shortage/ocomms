# OComms

## What This Is

OComms is a self-hosted team communication platform - a Slack-like experience that organizations can run on their own infrastructure. It provides real-time messaging, channels, threads, mentions, search, and presence features while giving teams full control over their data. Available as an installable PWA with offline support and push notifications for mobile access.

## Core Value

**Data sovereignty**: Complete control over communication data, no third-party dependencies

---

## Current State

**Version:** v0.6.0 (Polish & Hardening) - Shipped 2026-01-24

Security hardening with CSP nonces, Redis sessions, MFA, breach checking. Workspace management with switcher, discovery, and join flow. Sidebar reorganization with drag-drop reordering. Mobile redesign with More menu and 44px touch targets.

**Tech Stack:**
- Next.js 15 with App Router
- TypeScript (~57,900 LOC)
- PostgreSQL with Drizzle ORM (SSL encrypted)
- Socket.IO with Redis pub-sub
- BullMQ job queues with Redis
- Docker Compose deployment (HTTPS with Let's Encrypt)
- Serwist/Workbox for service worker
- Dexie.js for IndexedDB
- Web Push API

**What's Working:**
- Real-time messaging in channels and DMs
- Public/private channels with membership
- Single-level message threading
- Emoji reactions with emoji-mart picker (custom emoji support)
- @user, @channel, @here, @group mentions with notifications
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
- **v0.4.0:** Dark mode/light theme toggle with FOUC prevention
- **v0.4.0:** File uploads up to 25MB with drag-drop, clipboard paste, progress indicator
- **v0.4.0:** Image inline previews and download cards for attachments
- **v0.4.0:** Channel notes (shared markdown document per channel)
- **v0.4.0:** Personal notes scratchpad per user per workspace
- **v0.5.0:** Typing indicators with real-time "[Name] is typing..."
- **v0.5.0:** Channel archiving with read-only mode and unarchive
- **v0.5.0:** Channel categories with collapsible sidebar sections
- **v0.5.0:** Scheduled messages with timezone-aware delivery
- **v0.5.0:** Reminders on messages with snooze and recurring options
- **v0.5.0:** Bookmarks for saving messages and files
- **v0.5.0:** Custom user status with emoji, text, and DND mode
- **v0.5.0:** Link previews with Open Graph unfurling and SSRF protection
- **v0.5.0:** Custom emoji upload with SVG-to-PNG conversion
- **v0.5.0:** User groups for @team mentions
- **v0.5.0:** Guest accounts with channel-scoped access and auto-expiration
- **v0.5.0:** Workspace analytics dashboard (message volume, DAU/WAU/MAU, CSV export)
- **v0.6.0:** CSP nonces, Redis session validation, SVG upload blocking
- **v0.6.0:** Socket.IO rate limiting, Unicode sanitization, audit log integrity
- **v0.6.0:** Password breach checking, storage quotas, TOTP MFA
- **v0.6.0:** Workspace switcher with unreads, browse/join discovery
- **v0.6.0:** Sidebar drag-drop reordering with cross-device sync
- **v0.6.0:** Mobile More menu, status drawer, 44px touch targets

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

- **v0.4.0 - Files, Theming & Notes** (22 requirements)
  - THEME-01 to THEME-05: Light/dark toggle, system preference, persistence, FOUC prevention
  - FILE-01 to FILE-10: Drag-drop, click-browse, progress, image preview, download links, 25MB limit, magic bytes, channels, DMs, clipboard paste
  - NOTE-01 to NOTE-07: Channel notes, personal notes, markdown editing, preview, member editing, conflict detection, header access

- **v0.5.0 - Feature Completeness** (87 requirements)
  - TYPE-01 to TYPE-05: Typing indicators with throttle and broadcast
  - ARCH-01 to ARCH-06: Channel archiving with read-only mode
  - CCAT-01 to CCAT-06: Channel categories with collapsible sections
  - SCHD-01 to SCHD-07: Scheduled messages with timezone support
  - RMND-01 to RMND-07: Reminders with snooze and recurring
  - BOOK-01 to BOOK-05: Bookmarks for messages and files
  - STAT-01 to STAT-06: User status with emoji, text, DND mode
  - LINK-01 to LINK-07: Link previews with SSRF protection
  - EMOJ-01 to EMOJ-08: Custom emoji with SVG-to-PNG conversion
  - UGRP-01 to UGRP-06: User groups for @team mentions
  - GUST-01 to GUST-08: Guest accounts with channel restrictions
  - ANLY-01 to ANLY-08: Workspace analytics dashboard
  - TEST-01 to TEST-08: Testing and stabilization (2 descoped)

- **v0.6.0 - Polish & Hardening** (53 requirements)
  - SEC2-01 to SEC2-22: Security hardening (CSP, sessions, MFA, breach checks, quotas)
  - FIX-01 to FIX-05: Bug fixes (mobile DM, profile spacing, nav highlighting)
  - WKSP2-01 to WKSP2-06: Workspace management (switcher, discovery, join flow)
  - SIDE-01 to SIDE-08: Sidebar reorganization (drag-drop, cross-device sync)
  - MOBI2-01 to MOBI2-12: Mobile redesign (More menu, touch targets, responsive)

### Active

None - planning next milestone. Run `/gsd:new-milestone` to start v0.7.0.

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
| SSO / SAML | Enterprise auth complexity, deferred to future milestone |
| Integrations / Webhooks / Bots | API design complexity, deferred to future milestone |

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
| next-themes for theming | De facto standard, FOUC prevention built-in | Good |
| XHR for file uploads | Fetch API lacks upload progress events | Good |
| react-markdown for notes | XSS-safe, no dangerouslySetInnerHTML | Good |
| Last-write-wins for notes | CRDT/OT too complex; conflict detection sufficient | Good |
| 2s debounce for note save | Balance responsiveness and API load | Good |
| BullMQ for scheduled jobs | Redis-based, persistent across restarts | Good |
| unfurl library for link previews | Lightweight, no headless browser | Good |
| sharp for custom emoji | SVG-to-PNG conversion for XSS protection | Good |
| emoji-mart for picker | Custom emoji integration, lazy loading | Good |
| Guest soft-lock for expired access | 24-hour grace period, can view but not post | Good |
| Aggregate-only analytics | No individual user surveillance | Good |
| CSP nonce implementation | Eliminate inline script vulnerabilities | Good |
| Redis session validation | Immediate revocation, no cookie caching | Good |
| SVG blocking (raster-only) | Prevent XSS via malicious SVG content | Good |
| Bloom filter for breach check | 100 common passwords, minimal memory | Good |
| TOTP MFA with backup codes | Standard 2FA without hardware dependency | Good |
| dnd-kit for sidebar drag-drop | React 18/19 compatible, accessible | Good |
| Vaul for mobile drawers | Native iOS-style bottom sheets | Good |
| 44px touch targets | iOS HIG compliance | Good |

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
*Last updated: 2026-01-24 after v0.6.0 milestone completion*

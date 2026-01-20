# Project Milestones: OComms

## v0.4.0 Files, Theming & Notes (Shipped: 2026-01-20)

**Delivered:** Dark mode theming, file uploads with image previews, and markdown notes for channels and personal scratchpads.

**Phases completed:** 21-23 (9 plans total)

**Key accomplishments:**

- Dark Mode: Light/dark theme toggle with system preference detection and FOUC prevention
- Theme Audit: All 36+ UI components updated to use CSS variable-based theming
- File Uploads: Drag-drop, click-to-browse, clipboard paste with 25MB limit and magic bytes validation
- Image Previews: Inline image attachments with thumbnail display (max 400x300)
- Download Cards: Non-image files display as download links with filename and size
- Channel Notes: One shared markdown document per channel with real-time sync
- Personal Notes: Private workspace-scoped scratchpad accessible from sidebar
- Conflict Detection: Optimistic locking prevents silent overwrites on concurrent edits

**Stats:**

- 98 files created/modified
- +10,763 / -286 lines of code
- 3 phases, 9 plans, 22 requirements
- Same-day build

**Git range:** `feat(21-01)` → `docs(23)`

**What's next:** `/gsd:new-milestone` for v0.5.0 planning

---

## v0.3.0 Mobile & Polish (Shipped: 2026-01-19)

**Delivered:** PWA with offline messaging, push notifications, mobile-first navigation, and admin tools for a complete mobile experience.

**Phases completed:** 14-20 (23 plans total)

**Key accomplishments:**

- PWA Foundation: Installable app with service worker, offline page, install prompt, iOS guidance
- Offline Support: IndexedDB message cache (7-day retention), send queue, optimistic UI, auto-sync
- Push Notifications: Web Push with VAPID, subscription management, DM/mention alerts, per-channel settings
- Mobile Layout: Bottom tab bar, responsive navigation, 44px touch targets, pull-to-refresh, safe-area support
- Admin UI: Audit log viewer with filtering/CSV export, JSON data export (GDPR), role-based access
- Security Fixes: @mention org scoping, fail-closed middleware, atomic sequences, rate limiting, message limits

**Stats:**

- 144 files created/modified
- ~17,900 lines of TypeScript
- 7 phases, 23 plans, 38 requirements
- 2 days from start to ship

**Git range:** `a8e131a` → `51288f8`

**What's next:** Planning next milestone

---

## v0.2.0 Security Hardening (Shipped: 2026-01-18)

**Delivered:** Production-ready security baseline with authorization fixes, encrypted transport, hardened authentication, and audit trail.

**Phases completed:** 9-13 (24 plans total)

**Key accomplishments:**

- Fixed all authorization bypass vulnerabilities in Socket.IO handlers
- Transport security with HTTPS/Let's Encrypt and PostgreSQL SSL encryption
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Rate limiting on authentication and sensitive API endpoints
- Password strength validation with zxcvbn and real-time UI feedback
- Account lockout after 5 failed attempts with progressive delays
- Audit logging for security events with query API

**Stats:**

- 95 files created/modified
- ~16,000 lines of TypeScript
- 5 phases, 24 plans, 19 requirements
- 1 day from start to ship

**Git range:** `feat(09-01)` → `feat(13-03)`

**What's next:** Planning next milestone

---

## v0.1.0 Full Conversation (Shipped: 2026-01-18)

**Delivered:** Complete self-hosted team communication platform with real-time messaging, threading, notifications, search, and Docker deployment.

**Phases completed:** 1-8 (23 plans total)

**Key accomplishments:**

- Real-time messaging with Socket.IO/Redis pub-sub for instant delivery
- Complete channel system with public/private channels and membership
- Direct messages with 1:1 and group conversations
- Message threading with single-level replies and All Threads view
- Emoji reactions with frimousse picker and real-time sync
- @mentions with autocomplete, @channel/@here, notification delivery
- Unread management with per-channel badges and mark-as-read
- Full-text search using PostgreSQL native FTS
- Docker deployment with single `docker-compose up` command
- Backup/restore with pg_dump scripts and JSON data export

**Stats:**

- 220 files created/modified
- ~12,000 lines of TypeScript
- 8 phases, 23 plans, 51 requirements
- 1 day from start to ship

**Git range:** `cc7bb27` → `1cd8c2e`

**What's next:** Planning next milestone

---

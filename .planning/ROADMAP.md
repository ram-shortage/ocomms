# Roadmap: OComms

## Overview

OComms delivers a complete self-hosted team communication platform through 8 sequential phases. Starting with authentication and workspace foundations, we build up through real-time messaging, threading, notifications, and search — culminating in production-ready Docker deployment. Each phase delivers working functionality that builds on the previous, with the goal of a Slack-like experience under full organizational control.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Auth, workspaces, members, profiles
- [x] **Phase 2: Channels & DMs** - Conversation containers
- [x] **Phase 3: Real-Time Messaging** - WebSocket message delivery, presence
- [x] **Phase 4: Threading & Reactions** - Threads, emoji reactions, pins
- [x] **Phase 5: Mentions & Notifications** - @mentions, notification routing
- [ ] **Phase 6: Attention Management** - Unread counts, read state
- [ ] **Phase 7: Search** - Full-text message search
- [ ] **Phase 8: Self-Hosted Packaging** - Docker deployment, backup/restore

## Phase Details

### Phase 1: Foundation
**Goal**: Database schema, authentication, workspace/member primitives with profiles
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, WKSP-01, WKSP-02, WKSP-03, MEMB-01, MEMB-02, MEMB-03, MEMB-04, MEMB-05, MEMB-06
**Success Criteria** (what must be TRUE):
  1. User can create account with email/password and receive verification email
  2. User can log in and session persists across browser refresh
  3. User can log out from current session
  4. Admin can create workspace with tenant isolation
  5. User can be invited to join workspace
  6. Members have roles (member, admin, owner) that admin can change
  7. Member can create profile with display name and avatar
  8. Member can view other members' profiles
**Research**: Likely (new project, stack setup, auth patterns)
**Research topics**: Project scaffolding, PostgreSQL schema design, auth library (better-auth vs lucia), Drizzle ORM setup
**Plans**: TBD

Plans:
- [x] 01-01: Project scaffolding and database setup
- [x] 01-02: Authentication system
- [x] 01-03: Workspace and member management
- [x] 01-04: Member profiles and avatars

### Phase 2: Channels & DMs
**Goal**: Channel and DM primitives — conversation containers without messages yet
**Depends on**: Phase 1
**Requirements**: CHAN-01, CHAN-02, CHAN-03, CHAN-04, CHAN-05, CHAN-06, CHAN-07, DM-01, DM-02, DM-03
**Success Criteria** (what must be TRUE):
  1. Member can create public and private channels
  2. Member can browse channel directory and join public channels
  3. Member can leave channels
  4. Admin can invite members to private channels
  5. Member can set channel topic and description
  6. Member can start 1:1 DM with another member
  7. Member can start group DM (3+ members)
  8. Member can add participants to group DM
**Research**: Unlikely (CRUD operations, patterns established in Phase 1)
**Plans**: TBD

Plans:
- [x] 02-01: Channel CRUD and membership
- [x] 02-02: Channel management
- [x] 02-03: Direct messages

### Phase 3: Real-Time Messaging
**Goal**: Messages delivered instantly via WebSockets with basic presence
**Depends on**: Phase 2
**Requirements**: MSG-01, MSG-02, MSG-03, MSG-04, PRES-01, PRES-02
**Success Criteria** (what must be TRUE):
  1. Member can send message to channel and it appears instantly
  2. Member can send message in DM and it appears instantly
  3. Messages delivered in real-time (sub-second latency)
  4. Member can delete own messages
  5. Member presence shows as active/away/offline
  6. Presence updates in real-time across all clients
**Research**: Likely (WebSocket architecture, Redis pub/sub, Socket.IO setup)
**Research topics**: Socket.IO with uWebSockets adapter, Redis/Valkey pub/sub patterns, message ordering strategy
**Plans**: TBD

Plans:
- [x] 03-01: WebSocket gateway and Redis pub/sub
- [x] 03-02: Message persistence and delivery
- [x] 03-03: Presence system

### Phase 4: Threading & Reactions
**Goal**: Threaded conversations, emoji reactions, and pinned messages
**Depends on**: Phase 3
**Requirements**: THRD-01, THRD-02, THRD-03, THRD-04, REAC-01, REAC-02, REAC-03, CHAN-08, CHAN-09
**Success Criteria** (what must be TRUE):
  1. Member can reply to message to create thread
  2. Member can view thread replies in thread panel
  3. Member receives notifications for threads they're in
  4. Member can view "All Threads" across channels
  5. Member can add emoji reaction to message
  6. Member can remove own emoji reaction
  7. Member can see who reacted with each emoji
  8. Member can pin messages in channel
  9. Member can view pinned messages
**Research**: Unlikely (builds on Phase 3 messaging)
**Plans**: TBD

Plans:
- [x] 04-01: Threading model and UI
- [x] 04-02: Emoji reactions
- [x] 04-03: Pinned messages

### Phase 5: Mentions & Notifications
**Goal**: @mentions with notification delivery and channel settings
**Depends on**: Phase 4
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06
**Success Criteria** (what must be TRUE):
  1. Member can @mention another member in a message
  2. Mentioned member receives notification
  3. Member can use @channel to notify all channel members
  4. Member can use @here to notify active channel members
  5. Member can mute a channel (no notifications)
  6. Member can set channel to mention-only mode
**Research**: Unlikely (notification routing, builds on existing systems)
**Plans**: TBD

Plans:
- [x] 05-01: Mention parsing and highlighting
- [x] 05-02: Notification delivery
- [x] 05-03: Channel notification settings

### Phase 6: Attention Management
**Goal**: Unread counts and read state management
**Depends on**: Phase 5
**Requirements**: UNRD-01, UNRD-02, UNRD-03
**Success Criteria** (what must be TRUE):
  1. Member sees unread count per channel in sidebar
  2. Member can mark channel as read
  3. Member can mark message as unread for later
**Research**: Unlikely (read state tracking, established patterns)
**Plans**: TBD

Plans:
- [ ] 06-01: Read state tracking and unread counts

### Phase 7: Search
**Goal**: Full-text message search
**Depends on**: Phase 6
**Requirements**: SRCH-01, SRCH-02
**Success Criteria** (what must be TRUE):
  1. Member can search messages by keyword
  2. Search returns relevant results across channels member has access to
  3. Search respects channel permissions (no results from inaccessible channels)
**Research**: Likely (Meilisearch integration)
**Research topics**: Meilisearch Docker setup, indexing pipeline, search API design
**Plans**: TBD

Plans:
- [ ] 07-01: Search indexing and query

### Phase 8: Self-Hosted Packaging
**Goal**: Production-ready Docker deployment with data management
**Depends on**: Phase 7
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. Platform deploys with single docker-compose command
  2. Platform runs without external service dependencies
  3. Admin can backup all data
  4. Admin can restore from backup
  5. Admin can export all data in standard format
**Research**: Likely (Docker Compose configuration, volume management, health checks)
**Research topics**: Docker Compose best practices for self-hosted, backup scripts, data export formats
**Plans**: TBD

Plans:
- [ ] 08-01: Docker Compose configuration
- [ ] 08-02: Backup and restore tooling
- [ ] 08-03: Data export

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete | 2026-01-17 |
| 2. Channels & DMs | 3/3 | Complete | 2026-01-17 |
| 3. Real-Time Messaging | 3/3 | Complete | 2026-01-17 |
| 4. Threading & Reactions | 3/3 | Complete | 2026-01-18 |
| 5. Mentions & Notifications | 3/3 | Complete | 2026-01-18 |
| 6. Attention Management | 0/1 | Not started | - |
| 7. Search | 0/1 | Not started | - |
| 8. Self-Hosted Packaging | 0/3 | Not started | - |

**Total:** 16/20 plans complete

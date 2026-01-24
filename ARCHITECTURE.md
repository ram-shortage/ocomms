# OComms Architecture Documentation

**Version**: v0.6.0
**Last Updated**: 2026-01-24

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Data Flow & Sequence Diagrams](#2-data-flow--sequence-diagrams)
3. [API Design](#3-api-design)
4. [Data Model](#4-data-model)
5. [Algorithms & Business Logic](#5-algorithms--business-logic)
6. [Dependencies](#6-dependencies)

---

## 1. System Architecture

### 1.1 High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NGINX REVERSE PROXY                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  • SSL/TLS Termination (Let's Encrypt)                              │    │
│  │  • Rate Limiting                                                     │    │
│  │  • WebSocket Upgrade Handling                                        │    │
│  │  • Static Asset Caching                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
          ┌─────────────────┐             ┌─────────────────┐
          │   HTTP/REST     │             │   WebSocket     │
          │   (Port 3000)   │             │   (Socket.IO)   │
          └────────┬────────┘             └────────┬────────┘
                   │                               │
                   └───────────────┬───────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APPLICATION                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         APPLICATION LAYER                               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │ │
│  │  │ API Routes   │  │ Socket.IO    │  │ Server       │  │ Background │  │ │
│  │  │ (/api/*)     │  │ Handlers     │  │ Actions      │  │ Jobs       │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          SERVICE LAYER                                  │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │ │
│  │  │ Auth       │ │ Messaging  │ │ Presence   │ │ Notifications│         │ │
│  │  │ Service    │ │ Service    │ │ Service    │ │ Service     │         │ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │ │
│  │  │ File       │ │ Search     │ │ Scheduler  │ │ Guest      │          │ │
│  │  │ Service    │ │ Service    │ │ Service    │ │ Service    │          │ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           DATA LAYER                                    │ │
│  │  ┌─────────────────────────────────┐  ┌────────────────────────────┐   │ │
│  │  │         Drizzle ORM             │  │      Redis Client          │   │ │
│  │  │  (Type-safe Database Access)    │  │   (Pub/Sub, Cache, Jobs)   │   │ │
│  │  └─────────────────────────────────┘  └────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                   │                               │
                   ▼                               ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────────────┐
│         POSTGRESQL              │  │              REDIS                       │
│  ┌───────────────────────────┐  │  │  ┌─────────────────────────────────┐    │
│  │ • 29 Tables               │  │  │  │ • Presence State                │    │
│  │ • Full-Text Search (GIN)  │  │  │  │ • Socket.IO Adapter             │    │
│  │ • Migrations (Drizzle)    │  │  │  │ • BullMQ Job Queues             │    │
│  │ • Indexes                 │  │  │  │ • Rate Limiting State           │    │
│  └───────────────────────────┘  │  │  │ • Link Preview Cache            │    │
└─────────────────────────────────┘  │  └─────────────────────────────────┘    │
                                     └─────────────────────────────────────────┘
```

### 1.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React/Next.js)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         UI COMPONENTS (shadcn/ui)                    │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │ Sidebar  │ │ Channel  │ │ Message  │ │ Thread   │ │ Profile  │  │    │
│  │  │ Panel    │ │ View     │ │ List     │ │ Panel    │ │ Modal    │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           STATE MANAGEMENT                           │    │
│  │  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────┐ │    │
│  │  │ React Context      │  │ Socket.IO Client   │  │ IndexedDB      │ │    │
│  │  │ (App State)        │  │ (Real-time)        │  │ (Offline/PWA)  │ │    │
│  │  └────────────────────┘  └────────────────────┘  └────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           PWA LAYER                                  │    │
│  │  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────┐ │    │
│  │  │ Service Worker     │  │ Offline Queue      │  │ Push Notif.    │ │    │
│  │  │ (Workbox)          │  │ (Pending Msgs)     │  │ Handler        │ │    │
│  │  └────────────────────┘  └────────────────────┘  └────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Node.js)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │          REST API Layer          │  │        WebSocket Layer           │ │
│  │  ┌────────────────────────────┐  │  │  ┌────────────────────────────┐  │ │
│  │  │ /api/auth/*  (Better Auth) │  │  │  │ message:* handlers         │  │ │
│  │  │ /api/upload/* (Files)      │  │  │  │ typing:* handlers          │  │ │
│  │  │ /api/admin/* (Analytics)   │  │  │  │ presence:* handlers        │  │ │
│  │  │ /api/push/* (Web Push)     │  │  │  │ reaction:* handlers        │  │ │
│  │  │ /api/notes/* (Notes)       │  │  │  │ notification:* handlers    │  │ │
│  │  └────────────────────────────┘  │  │  │ note:* handlers            │  │ │
│  └──────────────────────────────────┘  │  └────────────────────────────┘  │ │
│                                        └──────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      BACKGROUND JOB QUEUES (BullMQ)                  │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐│    │
│  │  │ Scheduled  │ │ Reminder   │ │ Status     │ │ Attachment         ││    │
│  │  │ Messages   │ │ Queue      │ │ Expiration │ │ Cleanup            ││    │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────────────┘│    │
│  │  ┌────────────────────────┐  ┌────────────────────────────────────┐ │    │
│  │  │ Guest Expiration       │  │ Link Preview Fetcher               │ │    │
│  │  └────────────────────────┘  └────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Security Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRUST BOUNDARIES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ EXTERNAL (Untrusted)                                                 │    │
│  │  • Internet traffic                                                  │    │
│  │  • User-uploaded files                                               │    │
│  │  • External URLs (link previews)                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │ NGINX + TLS │                                   │
│                            └──────┬──────┘                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ DMZ (Semi-Trusted)                                                   │    │
│  │  • Rate limiting                                                     │    │
│  │  • Input validation                                                  │    │
│  │  • Authentication checks                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │ Auth Layer │                                    │
│                            └──────┬──────┘                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ APPLICATION (Trusted)                                                │    │
│  │  • Authenticated sessions                                            │    │
│  │  • Authorization checks                                              │    │
│  │  • Business logic                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │ ORM Layer │                                     │
│                            └──────┬──────┘                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ DATA (Highly Trusted)                                                │    │
│  │  • PostgreSQL (parameterized queries only)                           │    │
│  │  • Redis (internal network only)                                     │    │
│  │  • File system (validated paths only)                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

TENANT ISOLATION:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐       │
│  │  Workspace A    │     │  Workspace B    │     │  Workspace C    │       │
│  │  ┌───────────┐  │     │  ┌───────────┐  │     │  ┌───────────┐  │       │
│  │  │ Channels  │  │     │  │ Channels  │  │     │  │ Channels  │  │       │
│  │  │ Members   │  │     │  │ Members   │  │     │  │ Members   │  │       │
│  │  │ Files     │  │     │  │ Files     │  │     │  │ Files     │  │       │
│  │  │ Emoji     │  │     │  │ Emoji     │  │     │  │ Emoji     │  │       │
│  │  └───────────┘  │     │  └───────────┘  │     │  └───────────┘  │       │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘       │
│           │                       │                       │                 │
│           └───────────────────────┼───────────────────────┘                 │
│                                   ▼                                         │
│                    ┌─────────────────────────────┐                          │
│                    │  Organization ID Filter     │                          │
│                    │  (Every query scoped)       │                          │
│                    └─────────────────────────────┘                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow & Sequence Diagrams

### 2.1 Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │  NGINX   │     │  Next.js │     │  Better  │     │PostgreSQL│
│          │     │          │     │  Server  │     │  Auth    │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │  POST /api/auth/sign-in         │                │                │
     │  {email, password}              │                │                │
     │───────────────>│                │                │                │
     │                │  Forward       │                │                │
     │                │───────────────>│                │                │
     │                │                │                │                │
     │                │                │  Validate      │                │
     │                │                │───────────────>│                │
     │                │                │                │                │
     │                │                │                │  Check lockout │
     │                │                │                │───────────────>│
     │                │                │                │<───────────────│
     │                │                │                │                │
     │                │                │                │  Verify password
     │                │                │                │───────────────>│
     │                │                │                │<───────────────│
     │                │                │                │                │
     │                │                │    [If valid]  │                │
     │                │                │  Create session│                │
     │                │                │<───────────────│                │
     │                │                │                │                │
     │                │                │                │  Store session │
     │                │                │                │───────────────>│
     │                │                │                │<───────────────│
     │                │                │                │                │
     │                │  Set-Cookie:   │                │                │
     │                │  session_token │                │                │
     │<───────────────│<───────────────│                │                │
     │                │                │                │                │
     │    [On subsequent requests]     │                │                │
     │  Cookie: session_token          │                │                │
     │───────────────>│───────────────>│───────────────>│───────────────>│
     │                │                │  User context  │                │
     │<───────────────│<───────────────│<───────────────│<───────────────│
     │                │                │                │                │
```

### 2.2 Real-Time Message Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Sender  │     │Socket.IO │     │  Redis   │     │PostgreSQL│     │ Receiver │
│  Client  │     │  Server  │     │ Pub/Sub  │     │          │     │  Client  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │  message:send  │                │                │                │
     │  {channelId,   │                │                │                │
     │   content}     │                │                │                │
     │───────────────>│                │                │                │
     │                │                │                │                │
     │                │  Rate limit    │                │                │
     │                │  check         │                │                │
     │                │───────────────>│                │                │
     │                │<───────────────│                │                │
     │                │                │                │                │
     │                │  Insert message│                │                │
     │                │  (with sequence)               │                │
     │                │───────────────────────────────>│                │
     │                │<───────────────────────────────│                │
     │                │                │                │                │
     │                │  Parse @mentions               │                │
     │                │  (resolve users)               │                │
     │                │───────────────────────────────>│                │
     │                │<───────────────────────────────│                │
     │                │                │                │                │
     │                │  Publish to    │                │                │
     │                │  channel room  │                │                │
     │                │───────────────>│                │                │
     │                │                │───────────────────────────────>│
     │                │                │                │   message:new  │
     │                │                │                │                │
     │                │  Queue link    │                │                │
     │                │  preview job   │                │                │
     │                │───────────────>│                │                │
     │                │                │                │                │
     │                │  Create notifs │                │                │
     │                │  for mentions  │                │                │
     │                │───────────────────────────────>│                │
     │                │                │                │                │
     │                │  Broadcast     │                │                │
     │                │  notifications │                │                │
     │                │───────────────>│───────────────────────────────>│
     │                │                │                │ notification:new
     │                │                │                │                │
```

### 2.3 Scheduled Message Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │  Next.js │     │  BullMQ  │     │  Redis   │     │PostgreSQL│
│  Client  │     │  Server  │     │  Worker  │     │          │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │ Schedule msg   │                │                │                │
     │ {content,      │                │                │                │
     │  scheduledFor, │                │                │                │
     │  timezone}     │                │                │                │
     │───────────────>│                │                │                │
     │                │                │                │                │
     │                │  Insert scheduled_message       │                │
     │                │  status: 'pending'              │                │
     │                │───────────────────────────────────────────────>│
     │                │<───────────────────────────────────────────────│
     │                │                │                │                │
     │                │  Add job with  │                │                │
     │                │  delay         │                │                │
     │                │───────────────>│                │                │
     │                │                │───────────────>│                │
     │                │                │                │                │
     │  Success       │                │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
     │                │    ... time passes ...         │                │
     │                │                │                │                │
     │                │                │  Job triggers  │                │
     │                │                │<───────────────│                │
     │                │                │                │                │
     │                │                │  Update status │                │
     │                │                │  'processing'  │                │
     │                │                │───────────────────────────────>│
     │                │                │                │                │
     │                │                │  Send message  │                │
     │                │                │  via socket    │                │
     │                │<───────────────│                │                │
     │                │                │                │                │
     │                │                │  Update status │                │
     │                │                │  'sent'        │                │
     │                │                │───────────────────────────────>│
     │                │                │                │                │
```

### 2.4 File Upload Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │  NGINX   │     │  Next.js │     │  File    │     │PostgreSQL│
│          │     │          │     │  API     │     │  System  │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │ POST /api/upload/attachment     │                │                │
     │ multipart/form-data             │                │                │
     │───────────────>│───────────────>│                │                │
     │                │                │                │                │
     │                │                │  Validate file │                │
     │                │                │  • Size < 25MB │                │
     │                │                │  • Magic bytes │                │
     │                │                │  • Not SVG     │                │
     │                │                │                │                │
     │                │                │  Check quota   │                │
     │                │                │───────────────────────────────>│
     │                │                │<───────────────────────────────│
     │                │                │                │                │
     │                │                │  [If OK]       │                │
     │                │                │  Write file    │                │
     │                │                │───────────────>│                │
     │                │                │<───────────────│                │
     │                │                │                │                │
     │                │                │  Insert file_attachment         │
     │                │                │───────────────────────────────>│
     │                │                │<───────────────────────────────│
     │                │                │                │                │
     │                │                │  Update user_storage           │
     │                │                │───────────────────────────────>│
     │                │                │                │                │
     │  {id, url}     │                │                │                │
     │<───────────────│<───────────────│                │                │
     │                │                │                │                │
```

### 2.5 Guest Access Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Admin   │     │  Server  │     │  Guest   │     │PostgreSQL│
│          │     │          │     │          │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ Create guest   │                │                │
     │ invite         │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │                │ Insert guest_invites           │
     │                │ {token, channelIds, expiresAt} │
     │                │───────────────────────────────>│
     │                │<───────────────────────────────│
     │                │                │                │
     │  Invite link   │                │                │
     │<───────────────│                │                │
     │                │                │                │
     │  Share link    │                │                │
     │ - - - - - - - - - - - - - - - ->│                │
     │                │                │                │
     │                │  Join via link │                │
     │                │<───────────────│                │
     │                │                │                │
     │                │  Validate token│                │
     │                │───────────────────────────────>│
     │                │<───────────────────────────────│
     │                │                │                │
     │                │  Create member │                │
     │                │  {isGuest: true}               │
     │                │───────────────────────────────>│
     │                │                │                │
     │                │  Insert guest_channel_access   │
     │                │───────────────────────────────>│
     │                │                │                │
     │                │  Success       │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │                │                │
     │    ... guest accesses channel ...               │
     │                │                │                │
     │                │  message:send  │                │
     │                │<───────────────│                │
     │                │                │                │
     │                │  Check access  │                │
     │                │───────────────────────────────>│
     │                │<───────────────────────────────│
     │                │                │                │
     │                │  Check soft-lock               │
     │                │  (expiresAt > now?)            │
     │                │───────────────────────────────>│
     │                │<───────────────────────────────│
     │                │                │                │
     │                │  [If not locked]               │
     │                │  Allow message │                │
     │                │───────────────>│                │
     │                │                │                │
```

### 2.6 Presence & Typing Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User A  │     │Socket.IO │     │  Redis   │     │  User B  │
│          │     │  Server  │     │          │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ typing:start   │                │                │
     │ {channelId}    │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │                │  Broadcast to  │                │
     │                │  channel room  │                │
     │                │───────────────>│                │
     │                │                │  typing:update │
     │                │                │───────────────>│
     │                │                │                │
     │                │    ... 3 seconds ...           │
     │                │                │                │
     │ typing:stop    │                │                │
     │───────────────>│                │                │
     │                │───────────────>│                │
     │                │                │───────────────>│
     │                │                │                │
     │                │                │                │
     │ presence:      │                │                │
     │ setActive      │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │                │  HSET presence │                │
     │                │  {userId: active, ts}          │
     │                │───────────────>│                │
     │                │                │                │
     │                │  Broadcast to  │                │
     │                │  workspace     │                │
     │                │───────────────>│                │
     │                │                │ presence:update│
     │                │                │───────────────>│
     │                │                │                │
```

---

## 3. API Design

### 3.1 REST API Endpoints

#### Authentication Endpoints (Better Auth)

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/api/auth/sign-in/email` | Email/password login | 5/min |
| POST | `/api/auth/sign-up/email` | Create account | 3/min |
| POST | `/api/auth/forget-password` | Request password reset | 3/min |
| POST | `/api/auth/reset-password` | Complete password reset | 3/min |
| POST | `/api/auth/sign-out` | End session | - |
| GET | `/api/auth/session` | Get current session | - |
| POST | `/api/auth/two-factor/enable` | Enable 2FA | - |
| POST | `/api/auth/two-factor/verify` | Verify 2FA code | - |

#### File Upload Endpoints

| Method | Endpoint | Description | Auth | Limits |
|--------|----------|-------------|------|--------|
| POST | `/api/upload/attachment` | Upload file attachment | Required | 25MB, quota |
| POST | `/api/upload/avatar` | Upload user avatar | Required | 5MB |
| POST | `/api/upload/emoji` | Upload custom emoji | Admin | 256KB |

**Request (multipart/form-data):**
```
file: <binary>
```

**Response:**
```json
{
  "id": "att_abc123",
  "url": "/uploads/attachments/abc123.png",
  "filename": "screenshot.png",
  "size": 145832,
  "mimeType": "image/png"
}
```

#### Push Notification Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/push/vapid-public` | Get VAPID public key | Optional |
| POST | `/api/push/subscribe` | Register push subscription | Required |
| POST | `/api/push/unsubscribe` | Remove push subscription | Required |

**Subscribe Request:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

#### Notes Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/notes/personal?workspaceId=xxx` | Get personal notes | Required |
| POST | `/api/notes/personal` | Update personal notes | Required |
| GET | `/api/notes/channel?channelId=xxx` | Get channel notes | Required |
| POST | `/api/notes/channel` | Update channel notes | Required |

**Request/Response:**
```json
{
  "content": "# My Notes\n\nMarkdown content here...",
  "version": 5
}
```

#### Channel Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/channels/[channelId]/pins` | Get pinned messages | Required |
| POST | `/api/channels/[channelId]/pins` | Pin/unpin message | Required |
| GET | `/api/channels/[channelId]/notifications` | Get notification settings | Required |
| POST | `/api/channels/[channelId]/notifications` | Update notification settings | Required |

#### Admin Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/audit-logs` | Get audit logs | Owner |
| POST | `/api/admin/export` | Export user data (GDPR) | Owner |

**Audit Logs Query Parameters:**
```
?workspaceId=xxx
&startDate=2024-01-01
&endDate=2024-01-31
&action=login_success
&limit=100
&offset=0
```

**Export Response:**
```json
{
  "user": { ... },
  "messages": [ ... ],
  "files": [ ... ],
  "settings": { ... }
}
```

#### Session Management

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/sessions` | List active sessions | Required |
| POST | `/api/sessions/revoke` | Revoke session | Required |

#### Utility Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | None |
| GET | `/api/user/storage` | Get storage usage | Required |
| POST | `/api/workspace/last-visited` | Track last workspace | Required |
| POST | `/api/csp-report` | CSP violation reports | None |

### 3.2 WebSocket Events (Socket.IO)

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message:send` | `{channelId?, conversationId?, content, parentId?, attachmentIds?}` | Send message |
| `message:delete` | `{messageId}` | Delete message |
| `message:edit` | `{messageId, content}` | Edit message |
| `typing:start` | `{channelId?, conversationId?}` | Start typing indicator |
| `typing:stop` | `{channelId?, conversationId?}` | Stop typing indicator |
| `reaction:toggle` | `{messageId, emoji}` | Add/remove reaction |
| `presence:setActive` | `{workspaceId}` | Set user as active |
| `presence:setAway` | `{workspaceId}` | Set user as away |
| `presence:fetch` | `{userIds}` | Fetch presence for users |
| `notification:markRead` | `{notificationId}` | Mark notification read |
| `note:subscribe` | `{channelId}` | Subscribe to note updates |
| `note:unsubscribe` | `{channelId}` | Unsubscribe from note updates |
| `note:broadcast` | `{channelId, content, version}` | Broadcast note change |

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | `{message, channel}` | New message received |
| `message:deleted` | `{messageId, channelId}` | Message deleted |
| `message:edited` | `{message}` | Message edited |
| `typing:update` | `{channelId, userId, isTyping}` | Typing state changed |
| `reaction:update` | `{messageId, reactions}` | Reactions updated |
| `presence:update` | `{userId, status}` | User presence changed |
| `notification:new` | `{notification}` | New notification |
| `notification:read` | `{notificationId}` | Notification marked read |
| `unread:update` | `{channelId, count}` | Unread count changed |
| `workspace:unreadUpdate` | `{total}` | Workspace unread total |
| `thread:newReply` | `{parentId, reply}` | Thread reply received |
| `note:updated` | `{channelId, content, version}` | Note content updated |
| `linkPreview:ready` | `{messageId, preview}` | Link preview fetched |
| `reminder:fired` | `{reminder}` | Reminder triggered |
| `guest:locked` | `{channelId}` | Guest access expired |

### 3.3 Error Response Format

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retryAfter": 60
    }
  }
}
```

**Standard Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `QUOTA_EXCEEDED` | 413 | Storage quota exceeded |
| `FILE_TOO_LARGE` | 413 | File exceeds size limit |
| `INVALID_FILE_TYPE` | 400 | File type not allowed |
| `ACCOUNT_LOCKED` | 423 | Account is locked |
| `GUEST_LOCKED` | 403 | Guest access expired |

### 3.4 Versioning Strategy

Currently at **v1** (implicit). Future versioning will use:
- URL prefix: `/api/v2/...`
- Header: `Accept: application/vnd.ocomms.v2+json`

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CORE ENTITIES                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │ organizations│     │   members    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │     │ id (PK)      │     │ id (PK)      │
│ email        │────<│ name         │>────│ userId (FK)  │
│ name         │     │ slug         │     │ orgId (FK)   │
│ emailVerified│     │ logo         │     │ role         │
│ image        │     │ joinPolicy   │     │ isGuest      │
│ createdAt    │     │ createdAt    │     │ expiresAt    │
└──────────────┘     └──────────────┘     │ createdAt    │
       │                    │              └──────────────┘
       │                    │                     │
       ▼                    ▼                     │
┌──────────────┐     ┌──────────────┐            │
│   profiles   │     │   channels   │<───────────┘
├──────────────┤     ├──────────────┤
│ id (PK)      │     │ id (PK)      │
│ userId (FK)  │     │ orgId (FK)   │
│ orgId (FK)   │     │ name         │
│ displayName  │     │ description  │
│ avatarUrl    │     │ isPrivate    │
│ pronouns     │     │ isArchived   │
│ title        │     │ categoryId   │
│ bio          │     │ createdAt    │
│ timezone     │     └──────────────┘
└──────────────┘            │
                            │
                            ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   messages   │     │channel_members│    │  reactions   │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │     │ channelId(FK)│     │ id (PK)      │
│ channelId(FK)│>────│ userId (FK)  │     │ messageId(FK)│
│ conversationId     │ role         │     │ userId (FK)  │
│ authorId (FK)│     │ joinedAt     │     │ emoji        │
│ content      │     └──────────────┘     │ createdAt    │
│ parentId(FK) │                          └──────────────┘
│ sequence     │
│ replyCount   │
│ isDeleted    │
│ searchVector │──── GIN Index (Full-text)
│ createdAt    │
│ updatedAt    │
└──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           DIRECT MESSAGES                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────────────┐
│conversations │     │conversation_participants│
├──────────────┤     ├──────────────────────┤
│ id (PK)      │>────│ conversationId (FK)  │
│ orgId (FK)   │     │ userId (FK)          │
│ createdAt    │     │ joinedAt             │
│ updatedAt    │     └──────────────────────┘
└──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           NOTIFICATIONS & REMINDERS                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│notifications │     │  reminders   │     │scheduled_messages│
├──────────────┤     ├──────────────┤     ├──────────────────┤
│ id (PK)      │     │ id (PK)      │     │ id (PK)          │
│ userId (FK)  │     │ userId (FK)  │     │ authorId (FK)    │
│ type         │     │ messageId(FK)│     │ channelId (FK)   │
│ title        │     │ remindAt     │     │ content          │
│ body         │     │ status       │     │ scheduledFor     │
│ data (JSON)  │     │ recurrence   │     │ timezone         │
│ isRead       │     │ snoozedUntil │     │ status           │
│ createdAt    │     │ createdAt    │     │ jobId            │
└──────────────┘     └──────────────┘     │ error            │
                                          │ createdAt        │
                                          └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           FILES & MEDIA                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│file_attachments    │ link_previews│     │message_link_previews │
├──────────────┤     ├──────────────┤     ├──────────────────────┤
│ id (PK)      │     │ id (PK)      │     │ messageId (FK)       │
│ messageId(FK)│     │ url          │     │ linkPreviewId (FK)   │
│ filename     │     │ title        │     │ position             │
│ mimeType     │     │ description  │     └──────────────────────┘
│ size         │     │ imageUrl     │
│ path         │     │ siteName     │
│ uploadedBy   │     │ createdAt    │
│ createdAt    │     └──────────────┘
└──────────────┘

┌──────────────┐
│ custom_emojis│
├──────────────┤
│ id (PK)      │
│ orgId (FK)   │
│ name         │
│ imageUrl     │
│ uploadedBy   │
│ isAnimated   │
│ createdAt    │
└──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER STATE                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│user_statuses │     │  bookmarks   │     │channel_read_state    │
├──────────────┤     ├──────────────┤     ├──────────────────────┤
│ id (PK)      │     │ id (PK)      │     │ id (PK)              │
│ userId (FK)  │     │ userId (FK)  │     │ userId (FK)          │
│ orgId (FK)   │     │ messageId(FK)│     │ channelId (FK)       │
│ emoji        │     │ fileId (FK)  │     │ lastReadSequence     │
│ text         │     │ note         │     │ updatedAt            │
│ expiresAt    │     │ createdAt    │     └──────────────────────┘
│ dnd          │     └──────────────┘
│ createdAt    │
└──────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   sessions   │     │   accounts   │     │ two_factor   │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)      │     │ id (PK)      │     │ id (PK)      │
│ userId (FK)  │     │ userId (FK)  │     │ userId (FK)  │
│ token        │     │ provider     │     │ secret       │
│ expiresAt    │     │ providerId   │     │ backupCodes  │
│ ipAddress    │     │ createdAt    │     │ createdAt    │
│ userAgent    │     └──────────────┘     └──────────────┘
│ createdAt    │
└──────────────┘

┌──────────────┐     ┌──────────────────┐
│   lockout    │     │ password_history │
├──────────────┤     ├──────────────────┤
│ id (PK)      │     │ id (PK)          │
│ userId (FK)  │     │ userId (FK)      │
│ failedAttempts     │ passwordHash     │
│ lockoutCount │     │ createdAt        │
│ lockedUntil  │     └──────────────────┘
│ updatedAt    │
└──────────────┘
```

### 4.2 Table Definitions

#### Core Tables

```sql
-- Users (Better Auth managed)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  image TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Organizations/Workspaces
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo TEXT,
  join_policy TEXT DEFAULT 'invite' CHECK (join_policy IN ('invite', 'request', 'open')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Workspace Membership
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  is_guest BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Channels
CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  category_id TEXT REFERENCES channel_categories(id),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_channels_org ON channels(organization_id);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  parent_id TEXT REFERENCES messages(id),
  sequence INTEGER NOT NULL,
  reply_count INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  search_vector TSVECTOR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (channel_id IS NOT NULL OR conversation_id IS NOT NULL),
  UNIQUE(channel_id, sequence),
  UNIQUE(conversation_id, sequence)
);
CREATE INDEX idx_messages_channel ON messages(channel_id, sequence DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, sequence DESC);
CREATE INDEX idx_messages_parent ON messages(parent_id);
CREATE INDEX idx_messages_search ON messages USING GIN(search_vector);
```

#### Session & Auth Tables

```sql
-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);

-- Account Lockout
CREATE TABLE lockout (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  failed_attempts INTEGER DEFAULT 0,
  lockout_count INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Password History
CREATE TABLE password_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_password_history_user ON password_history(user_id);
```

#### Notification Tables

```sql
-- Notifications
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'channel', 'here', 'thread_reply')),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- Reminders
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
  remind_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fired', 'snoozed', 'completed', 'cancelled')),
  recurrence TEXT CHECK (recurrence IN ('daily', 'weekly')),
  snoozed_until TIMESTAMP,
  job_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_reminders_user ON reminders(user_id, status);

-- Scheduled Messages
CREATE TABLE scheduled_messages (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT REFERENCES channels(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  job_id TEXT,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_scheduled_messages_author ON scheduled_messages(author_id, status);
```

### 4.3 Index Strategy

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `messages` | `(channel_id, sequence DESC)` | B-tree | Paginated message loading |
| `messages` | `search_vector` | GIN | Full-text search |
| `messages` | `parent_id` | B-tree | Thread queries |
| `notifications` | `(user_id, is_read, created_at)` | B-tree | Unread notifications |
| `sessions` | `token` | Hash | Session lookup |
| `channels` | `organization_id` | B-tree | Workspace channels |
| `members` | `(user_id, organization_id)` | B-tree (Unique) | Membership lookup |
| `channel_read_state` | `(user_id, channel_id)` | B-tree (Unique) | Unread tracking |

### 4.4 Migration Strategy

Migrations are managed by **Drizzle ORM** with the following conventions:

```
src/db/migrations/
├── 0000_initial_schema.sql
├── 0001_add_threading.sql
├── 0002_add_reactions.sql
├── 0003_add_scheduled_messages.sql
├── 0004_add_guest_access.sql
└── 0005_rapid_squirrel_girl.sql
```

**Migration Commands:**
```bash
# Generate migration from schema changes
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Push schema (development only)
npm run db:push
```

---

## 5. Algorithms & Business Logic

### 5.1 Message Sequencing

**Problem:** Prevent duplicate messages and enable efficient pagination.

**Solution:** Each message has a monotonically increasing sequence number per channel/conversation.

```typescript
// Pseudocode for message insertion
async function sendMessage(channelId: string, content: string) {
  // Get next sequence in transaction
  const result = await db.transaction(async (tx) => {
    // Lock and get max sequence
    const [{ maxSeq }] = await tx
      .select({ maxSeq: sql`COALESCE(MAX(sequence), 0)` })
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .for('update');

    // Insert with next sequence
    const [message] = await tx
      .insert(messages)
      .values({
        id: generateId(),
        channelId,
        content,
        sequence: maxSeq + 1,
        authorId: userId
      })
      .returning();

    return message;
  });

  return result;
}
```

### 5.2 Mention Parsing

**Flow:**
```
Input: "Hey @john and @designers, check this out @here"
                ↓
┌─────────────────────────────────────────┐
│          Parse Mentions                  │
│  ┌─────────────────────────────────────┐│
│  │ Regex: /@(\w+)/g                    ││
│  │ Matches: ['john', 'designers', 'here']│
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│         Resolve Each Mention             │
│  ┌─────────────────────────────────────┐│
│  │ @john → User lookup → userId        ││
│  │ @designers → Group lookup → userIds ││
│  │ @here → Active presence → userIds   ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│        Create Notifications              │
│  ┌─────────────────────────────────────┐│
│  │ For each resolved userId:           ││
│  │ - Check notification settings       ││
│  │ - Check DND status                  ││
│  │ - Insert notification if allowed    ││
│  │ - Emit socket event                 ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### 5.3 Account Lockout Algorithm

```typescript
const LOCKOUT_CONFIG = {
  maxAttempts: 5,
  delays: [0, 1000, 2000, 5000, 10000], // ms between attempts
  durations: [15 * 60, 30 * 60, 60 * 60], // seconds
};

async function handleLoginAttempt(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    // Same response to prevent enumeration
    return { error: 'Invalid credentials' };
  }

  const lockout = await getLockout(user.id);

  // Check if currently locked
  if (lockout?.lockedUntil && lockout.lockedUntil > new Date()) {
    return { error: 'Account temporarily locked' };
  }

  // Enforce delay between attempts
  const delay = LOCKOUT_CONFIG.delays[
    Math.min(lockout?.failedAttempts ?? 0, LOCKOUT_CONFIG.delays.length - 1)
  ];
  if (delay > 0) {
    await sleep(delay);
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    const attempts = (lockout?.failedAttempts ?? 0) + 1;

    if (attempts >= LOCKOUT_CONFIG.maxAttempts) {
      // Lock the account
      const lockoutIndex = Math.min(
        lockout?.lockoutCount ?? 0,
        LOCKOUT_CONFIG.durations.length - 1
      );
      const duration = LOCKOUT_CONFIG.durations[lockoutIndex];

      await setLockout(user.id, {
        failedAttempts: 0,
        lockoutCount: (lockout?.lockoutCount ?? 0) + 1,
        lockedUntil: new Date(Date.now() + duration * 1000)
      });

      await sendLockoutEmail(user.email);
    } else {
      await updateFailedAttempts(user.id, attempts);
    }

    return { error: 'Invalid credentials' };
  }

  // Success - reset lockout
  await clearLockout(user.id);
  return { user };
}
```

### 5.4 Unread Count Calculation

```typescript
// Efficient unread count using sequence numbers
async function getUnreadCount(userId: string, channelId: string) {
  const result = await db
    .select({
      count: sql<number>`
        COUNT(*) FILTER (
          WHERE messages.sequence > COALESCE(channel_read_state.last_read_sequence, 0)
        )
      `
    })
    .from(messages)
    .leftJoin(
      channelReadState,
      and(
        eq(channelReadState.channelId, channelId),
        eq(channelReadState.userId, userId)
      )
    )
    .where(
      and(
        eq(messages.channelId, channelId),
        eq(messages.isDeleted, false)
      )
    );

  return result[0].count;
}

// Mark channel as read
async function markAsRead(userId: string, channelId: string, sequence: number) {
  await db
    .insert(channelReadState)
    .values({ userId, channelId, lastReadSequence: sequence })
    .onConflictDoUpdate({
      target: [channelReadState.userId, channelReadState.channelId],
      set: { lastReadSequence: sequence, updatedAt: new Date() }
    });
}
```

### 5.5 Rate Limiting

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';

const rateLimiters = {
  messages: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:msg',
    points: 10,           // 10 messages
    duration: 60,         // per 60 seconds
    blockDuration: 60,    // block for 60s if exceeded
  }),

  auth: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:auth',
    points: 5,            // 5 attempts
    duration: 60,         // per minute
    blockDuration: 300,   // block for 5 min
  }),

  upload: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:upload',
    points: 20,           // 20 uploads
    duration: 3600,       // per hour
  }),
};

async function checkRateLimit(limiter: string, key: string) {
  try {
    await rateLimiters[limiter].consume(key);
    return true;
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      return false;
    }
    throw error;
  }
}
```

### 5.6 File Validation

```typescript
const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // + WEBP at offset 8
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};

const BLOCKED_TYPES = ['image/svg+xml'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

async function validateFile(buffer: Buffer, filename: string) {
  // Check size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('FILE_TOO_LARGE');
  }

  // Detect type from magic bytes
  const detectedType = detectMimeType(buffer);

  // Block dangerous types
  if (BLOCKED_TYPES.includes(detectedType)) {
    throw new Error('INVALID_FILE_TYPE');
  }

  // Verify against whitelist
  if (!Object.keys(MAGIC_BYTES).includes(detectedType)) {
    throw new Error('INVALID_FILE_TYPE');
  }

  return { mimeType: detectedType, size: buffer.length };
}

function detectMimeType(buffer: Buffer): string {
  for (const [mime, bytes] of Object.entries(MAGIC_BYTES)) {
    if (bytes.every((byte, i) => buffer[i] === byte)) {
      return mime;
    }
  }
  return 'application/octet-stream';
}
```

### 5.7 Guest Access Control

```typescript
async function canGuestAccessChannel(userId: string, channelId: string) {
  const member = await db.query.members.findFirst({
    where: eq(members.userId, userId)
  });

  if (!member?.isGuest) {
    return { allowed: true, canPost: true };
  }

  // Check explicit channel access
  const access = await db.query.guestChannelAccess.findFirst({
    where: and(
      eq(guestChannelAccess.userId, userId),
      eq(guestChannelAccess.channelId, channelId)
    )
  });

  if (!access) {
    return { allowed: false, canPost: false };
  }

  // Check soft-lock (expired guests can view but not post)
  const isExpired = member.expiresAt && member.expiresAt < new Date();

  return {
    allowed: true,
    canPost: !isExpired
  };
}
```

### 5.8 Edge Cases

| Scenario | Handling |
|----------|----------|
| **Concurrent message sends** | Sequence numbers with unique constraint + retry |
| **Offline message send** | Queue in IndexedDB, sync on reconnect |
| **Thread parent deleted** | Replies preserved, parent shows "[deleted]" |
| **User deleted mid-conversation** | Messages show "[deleted user]", content preserved |
| **File orphaned (message deleted)** | Daily cleanup job removes after 7 days |
| **Expired guest tries to post** | Soft-lock: 403 with "guest:locked" event |
| **Scheduled message author deleted** | Job fails gracefully, status = 'failed' |
| **Reminder on deleted message** | Reminder still fires, links to original context |
| **Rate limit during typing** | Typing events dropped silently |
| **WebSocket disconnect** | Auto-reconnect with exponential backoff |

---

## 6. Dependencies

### 6.1 Internal Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTERNAL SERVICE MAP                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │ Auth Service │──────────────────────────────────────────┐                │
│  │ (Better Auth)│                                          │                │
│  └──────────────┘                                          │                │
│         │                                                  │                │
│         │ Session/User context                             │                │
│         ▼                                                  ▼                │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  Messaging   │────>│ Notification │────>│   Presence   │                │
│  │   Service    │     │   Service    │     │   Service    │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│         │                    │                    │                         │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │    Search    │     │    Queue     │     │    Guest     │                │
│  │   Service    │     │   Service    │     │   Service    │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│         │                    │                    │                         │
│         └────────────────────┼────────────────────┘                         │
│                              ▼                                              │
│                       ┌──────────────┐                                      │
│                       │    File      │                                      │
│                       │   Service    │                                      │
│                       └──────────────┘                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 External Services

| Service | Purpose | Required | Fallback |
|---------|---------|----------|----------|
| **PostgreSQL** | Primary database | Yes | None |
| **Redis** | Pub/sub, jobs, presence | No | In-memory (degraded) |
| **SMTP Server** | Email delivery | No | Console logging |
| **Web Push (FCM/APNS)** | Push notifications | No | Disabled |

### 6.3 NPM Dependencies

#### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.3 | React framework |
| `react` | 19.2.3 | UI library |
| `socket.io` | 4.8.3 | WebSocket server |
| `socket.io-client` | 4.8.3 | WebSocket client |
| `drizzle-orm` | 0.45.1 | Database ORM |
| `postgres` | 3.5.2 | PostgreSQL driver |
| `better-auth` | 1.4.14 | Authentication |
| `bullmq` | 5.66.5 | Job queues |
| `ioredis` | 5.6.0 | Redis client |
| `pino` | 10.2.1 | Logging |
| `bcryptjs` | 3.0.3 | Password hashing |
| `sharp` | 0.34.0 | Image processing |
| `web-push` | 3.6.7 | Push notifications |
| `nodemailer` | 7.0.12 | Email sending |
| `unfurl.js` | 6.4.0 | Link previews |
| `dexie` | 4.2.1 | IndexedDB (offline) |
| `tailwindcss` | 4.1.7 | CSS framework |
| `date-fns` | 4.1.0 | Date utilities |
| `zod` | 3.25.42 | Schema validation |
| `rate-limiter-flexible` | 9.0.1 | Rate limiting |

#### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | 5.8.3 | Type checking |
| `vitest` | 3.2.4 | Testing |
| `@testing-library/react` | 16.3.0 | Component testing |
| `drizzle-kit` | 0.31.0 | DB migrations |
| `eslint` | 9.28.0 | Linting |
| `prettier` | 3.5.3 | Formatting |

### 6.4 Infrastructure Dependencies

```yaml
# docker-compose.yml services
services:
  app:
    image: node:20-alpine
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
```

### 6.5 Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/ocomms
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional - Redis
REDIS_URL=redis://localhost:6379

# Optional - Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM=noreply@example.com

# Optional - Push Notifications
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=admin@example.com

# Optional - Security
ALLOWED_ORIGINS=https://your-domain.com
RATE_LIMIT_ENABLED=true
```

---

## Appendix: Quick Reference

### API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Sign-in | 5 | 1 min |
| Sign-up | 3 | 1 min |
| Password reset | 3 | 1 min |
| Messages | 10 | 1 min |
| File uploads | 20 | 1 hour |
| Default | 100 | 1 min |

### File Limits

| Type | Max Size | Allowed Formats |
|------|----------|-----------------|
| Attachment | 25 MB | JPEG, PNG, GIF, WebP, PDF |
| Avatar | 5 MB | JPEG, PNG, WebP |
| Emoji | 256 KB | PNG, GIF |

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 413 | Payload Too Large |
| 423 | Locked |
| 429 | Too Many Requests |
| 500 | Server Error |

---

*This document is auto-generated and should be kept in sync with the codebase.*

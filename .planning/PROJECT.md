# OComms

## What This Is

OComms is a self-hosted team communication platform - a Slack-like experience that organizations can run on their own infrastructure. It provides real-time messaging, channels, threads, and presence features while giving teams full control over their data.

## Core Value

- **Data sovereignty**: Complete control over communication data, no third-party dependencies
- **Self-hosted**: Deploy on your own infrastructure (cloud or on-premise)
- **Deep customization**: Modify and extend without vendor limitations
- **Cost control**: No per-seat pricing at scale

## Target Users

Internal tool for organizations with 500+ concurrent users who need:
- Real-time team communication
- Full control over their data
- Self-hosting capability
- Multi-platform access (Web, Desktop, Mobile)

---

## Active Milestone: Full Conversation

The first milestone delivers the core communication experience - everything needed for teams to have effective conversations.

### Requirements

#### Core Primitives
- **Workspace**: Tenant boundary isolating organizations
- **Member**: User identity within a workspace with roles (member, admin, owner)
- **Channel**: Shared conversation space (public or private)
- **DM**: Direct messages between members
- **Message**: Content unit with rich text support
- **Thread**: Replies branching from a parent message

#### 1. Conversation Structure
- **1.1 Channels**: Public channels (discoverable, joinable) and private channels (invite-only)
- **1.2 Threads**: Reply to any message to create a threaded discussion
- **1.3 Channel metadata**: Topic and description for channel context
- **1.4 Pins/bookmarks**: Pin important messages for quick reference

#### 2. Findability
- **2.1 Power search**: Search across messages, files, people, and channels

#### 3. Attention Management
- **3.1 DND + schedules**: Do Not Disturb mode with configurable notification schedules
- **3.2 Status + presence**: Availability indicators (online, away, busy, offline) with custom status
- **3.3 Mentions**: @person, @channel, @here with proper notification routing
- **3.4 Unreads management**: Mark unread, drafts persistence, unified unreads view

#### 4. Acknowledgment
- **4.1 Emoji reactions**: React to messages with emoji

---

## Out of Scope (This Milestone)

| Feature | Reason |
|---------|--------|
| AI features (summaries, Q&A) | Enhancement layer, not core communication |
| Canvas (document surface) | Content creation, separate from messaging |
| Lists (task tracking) | Workflow feature, not communication |
| Huddles (audio/video) | Synchronous communication, complex infrastructure |
| Clips (async video) | Media feature, not core messaging |
| Workflow Builder | Automation layer, builds on messaging |
| Shared channels | External collaboration adds multi-tenant complexity |
| Integrations/apps | Ecosystem feature, requires stable core first |

---

## Constraints

### Scale
- Support 500+ concurrent users per workspace
- Handle message bursts (all-hands announcements, incidents)
- Maintain responsiveness under load

### Real-time
- Instant message delivery via WebSockets
- Typing indicators with minimal latency
- Presence updates propagated immediately
- No polling-based fallbacks for core features

### Multi-platform
- Web (primary)
- Desktop (Electron or similar)
- Mobile (iOS + Android)
- Consistent experience across platforms

### Self-hosted
- Single-command deployment target
- No external service dependencies for core features
- Reasonable hardware requirements
- Clear operational documentation

---

## Key Decisions

### Authentication
- Built-in authentication (email/password, magic links)
- Optional SSO/SAML integration for enterprise
- Session management with secure token handling

### Real-time Architecture
- WebSocket-based for all real-time features
- Connection multiplexing per client
- Graceful reconnection handling
- Server-side event ordering

---

## Open Questions

- Tech stack selection (pending research)
- Database choice for message storage at scale
- File storage approach
- Search infrastructure

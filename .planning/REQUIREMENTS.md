# Requirements: OComms

**Defined:** 2026-01-17
**Core Value:** Data sovereignty - Complete control over communication data, no third-party dependencies

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User receives email verification after signup
- [ ] **AUTH-03**: User session persists across browser refresh
- [ ] **AUTH-04**: User can log out from current session

### Workspaces

- [ ] **WKSP-01**: Admin can create a new workspace
- [ ] **WKSP-02**: Workspace provides tenant isolation (data separated)
- [ ] **WKSP-03**: User can be invited to join workspace

### Members

- [ ] **MEMB-01**: Member has role (member, admin, owner)
- [ ] **MEMB-02**: Admin can change member roles
- [ ] **MEMB-03**: Admin can remove members from workspace
- [ ] **MEMB-04**: Member can create profile with display name
- [ ] **MEMB-05**: Member can upload avatar image
- [ ] **MEMB-06**: Member can view other members' profiles

### Channels

- [ ] **CHAN-01**: Member can create public channel
- [ ] **CHAN-02**: Member can create private channel
- [ ] **CHAN-03**: Member can browse channel directory
- [ ] **CHAN-04**: Member can join public channel
- [ ] **CHAN-05**: Member can leave channel
- [ ] **CHAN-06**: Admin can invite members to private channel
- [ ] **CHAN-07**: Member can set channel topic and description
- [ ] **CHAN-08**: Member can pin messages in channel
- [ ] **CHAN-09**: Member can view pinned messages

### Direct Messages

- [ ] **DM-01**: Member can start 1:1 DM with another member
- [ ] **DM-02**: Member can start group DM (3+ members)
- [ ] **DM-03**: Member can add participants to group DM

### Messaging

- [ ] **MSG-01**: Member can send message to channel
- [ ] **MSG-02**: Member can send message in DM
- [ ] **MSG-03**: Messages delivered in real-time (sub-second)
- [ ] **MSG-04**: Member can delete own messages

### Threading

- [ ] **THRD-01**: Member can reply to message to create thread
- [ ] **THRD-02**: Member can view thread replies in thread panel
- [ ] **THRD-03**: Member receives notifications for threads they're in
- [ ] **THRD-04**: Member can view "All Threads" across channels

### Mentions & Notifications

- [ ] **NOTF-01**: Member can @mention another member
- [ ] **NOTF-02**: Mentioned member receives notification
- [ ] **NOTF-03**: Member can use @channel to notify all channel members
- [ ] **NOTF-04**: Member can use @here to notify active channel members
- [ ] **NOTF-05**: Member can mute a channel
- [ ] **NOTF-06**: Member can set channel to mention-only mode

### Search

- [ ] **SRCH-01**: Member can search messages by keyword
- [ ] **SRCH-02**: Search returns relevant results across channels member has access to

### Presence

- [ ] **PRES-01**: Member presence shows as active/away/offline
- [ ] **PRES-02**: Presence updates in real-time

### Unread Management

- [ ] **UNRD-01**: Member sees unread count per channel
- [ ] **UNRD-02**: Member can mark channel as read
- [ ] **UNRD-03**: Member can mark message as unread

### Emoji Reactions

- [ ] **REAC-01**: Member can add emoji reaction to message
- [ ] **REAC-02**: Member can remove own emoji reaction
- [ ] **REAC-03**: Member can see who reacted with each emoji

### Self-Hosted Infrastructure

- [ ] **INFR-01**: Platform deploys with single docker-compose command
- [ ] **INFR-02**: Platform runs without external service dependencies
- [ ] **INFR-03**: Admin can backup all data
- [ ] **INFR-04**: Admin can restore from backup
- [ ] **INFR-05**: Admin can export all data in standard format

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication

- **AUTH-V2-01**: User can login via magic link (passwordless)
- **AUTH-V2-02**: User can reset password via email
- **AUTH-V2-03**: Admin can configure SSO/SAML integration

### Messaging

- **MSG-V2-01**: Member can edit own messages
- **MSG-V2-02**: Messages support rich text formatting

### Threading

- **THRD-V2-01**: Member can choose to "Reply also to channel"

### Mentions & Notifications

- **NOTF-V2-01**: Member can set DND mode
- **NOTF-V2-02**: Member can configure notification schedules (quiet hours)

### Search

- **SRCH-V2-01**: Member can use power search modifiers (in:, from:, before:, after:)
- **SRCH-V2-02**: Member can search files, people, and channels

### Presence & Status

- **PRES-V2-01**: Member presence auto-detects away after inactivity
- **PRES-V2-02**: Member can set custom status (emoji + text)
- **PRES-V2-03**: Member can set status expiration

### Unread Management

- **UNRD-V2-01**: Member can save message drafts
- **UNRD-V2-02**: Member can view unified unreads across all channels

### Emoji Reactions

- **REAC-V2-01**: Admin can upload custom emoji
- **REAC-V2-02**: Member can use custom emoji in reactions

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AI summaries/Q&A | Breaks self-hosted value prop (external API dependencies) |
| Video/audio calls (Huddles) | Massive infrastructure complexity (WebRTC, TURN servers) |
| Workflow Builder | Enterprise scope creep |
| Shared channels (federation) | Multi-tenant complexity |
| Canvas/Docs | Different product |
| Lists/Tasks | Different product |
| Nested threading | No major platform does this, complexity trap |
| Read receipts | Privacy concerns, complexity at scale |
| Message scheduling | Not essential for v1 |
| Mobile native apps | Web-first; responsive web sufficient for v1 |
| Desktop app (Tauri) | Web-first for v1 |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| AUTH-04 | TBD | Pending |
| WKSP-01 | TBD | Pending |
| WKSP-02 | TBD | Pending |
| WKSP-03 | TBD | Pending |
| MEMB-01 | TBD | Pending |
| MEMB-02 | TBD | Pending |
| MEMB-03 | TBD | Pending |
| MEMB-04 | TBD | Pending |
| MEMB-05 | TBD | Pending |
| MEMB-06 | TBD | Pending |
| CHAN-01 | TBD | Pending |
| CHAN-02 | TBD | Pending |
| CHAN-03 | TBD | Pending |
| CHAN-04 | TBD | Pending |
| CHAN-05 | TBD | Pending |
| CHAN-06 | TBD | Pending |
| CHAN-07 | TBD | Pending |
| CHAN-08 | TBD | Pending |
| CHAN-09 | TBD | Pending |
| DM-01 | TBD | Pending |
| DM-02 | TBD | Pending |
| DM-03 | TBD | Pending |
| MSG-01 | TBD | Pending |
| MSG-02 | TBD | Pending |
| MSG-03 | TBD | Pending |
| MSG-04 | TBD | Pending |
| THRD-01 | TBD | Pending |
| THRD-02 | TBD | Pending |
| THRD-03 | TBD | Pending |
| THRD-04 | TBD | Pending |
| NOTF-01 | TBD | Pending |
| NOTF-02 | TBD | Pending |
| NOTF-03 | TBD | Pending |
| NOTF-04 | TBD | Pending |
| NOTF-05 | TBD | Pending |
| NOTF-06 | TBD | Pending |
| SRCH-01 | TBD | Pending |
| SRCH-02 | TBD | Pending |
| PRES-01 | TBD | Pending |
| PRES-02 | TBD | Pending |
| UNRD-01 | TBD | Pending |
| UNRD-02 | TBD | Pending |
| UNRD-03 | TBD | Pending |
| REAC-01 | TBD | Pending |
| REAC-02 | TBD | Pending |
| REAC-03 | TBD | Pending |
| INFR-01 | TBD | Pending |
| INFR-02 | TBD | Pending |
| INFR-03 | TBD | Pending |
| INFR-04 | TBD | Pending |
| INFR-05 | TBD | Pending |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 0
- Unmapped: 51 ⚠️ (will be mapped by create-roadmap)

---
*Requirements defined: 2026-01-17*
*Last updated: 2026-01-17 after initial definition*

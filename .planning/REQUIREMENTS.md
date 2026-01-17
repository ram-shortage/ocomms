# Requirements: OComms

**Defined:** 2026-01-17
**Core Value:** Data sovereignty - Complete control over communication data, no third-party dependencies

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can sign up with email and password
- [x] **AUTH-02**: User receives email verification after signup
- [x] **AUTH-03**: User session persists across browser refresh
- [x] **AUTH-04**: User can log out from current session

### Workspaces

- [x] **WKSP-01**: Admin can create a new workspace
- [x] **WKSP-02**: Workspace provides tenant isolation (data separated)
- [x] **WKSP-03**: User can be invited to join workspace

### Members

- [x] **MEMB-01**: Member has role (member, admin, owner)
- [x] **MEMB-02**: Admin can change member roles
- [x] **MEMB-03**: Admin can remove members from workspace
- [x] **MEMB-04**: Member can create profile with display name
- [x] **MEMB-05**: Member can upload avatar image
- [x] **MEMB-06**: Member can view other members' profiles

### Channels

- [x] **CHAN-01**: Member can create public channel
- [x] **CHAN-02**: Member can create private channel
- [x] **CHAN-03**: Member can browse channel directory
- [x] **CHAN-04**: Member can join public channel
- [x] **CHAN-05**: Member can leave channel
- [x] **CHAN-06**: Admin can invite members to private channel
- [x] **CHAN-07**: Member can set channel topic and description
- [ ] **CHAN-08**: Member can pin messages in channel
- [ ] **CHAN-09**: Member can view pinned messages

### Direct Messages

- [x] **DM-01**: Member can start 1:1 DM with another member
- [x] **DM-02**: Member can start group DM (3+ members)
- [x] **DM-03**: Member can add participants to group DM

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

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| WKSP-01 | Phase 1 | Complete |
| WKSP-02 | Phase 1 | Complete |
| WKSP-03 | Phase 1 | Complete |
| MEMB-01 | Phase 1 | Complete |
| MEMB-02 | Phase 1 | Complete |
| MEMB-03 | Phase 1 | Complete |
| MEMB-04 | Phase 1 | Complete |
| MEMB-05 | Phase 1 | Complete |
| MEMB-06 | Phase 1 | Complete |
| CHAN-01 | Phase 2 | Complete |
| CHAN-02 | Phase 2 | Complete |
| CHAN-03 | Phase 2 | Complete |
| CHAN-04 | Phase 2 | Complete |
| CHAN-05 | Phase 2 | Complete |
| CHAN-06 | Phase 2 | Complete |
| CHAN-07 | Phase 2 | Complete |
| CHAN-08 | Phase 4 | Pending |
| CHAN-09 | Phase 4 | Pending |
| DM-01 | Phase 2 | Complete |
| DM-02 | Phase 2 | Complete |
| DM-03 | Phase 2 | Complete |
| MSG-01 | Phase 3 | Pending |
| MSG-02 | Phase 3 | Pending |
| MSG-03 | Phase 3 | Pending |
| MSG-04 | Phase 3 | Pending |
| THRD-01 | Phase 4 | Pending |
| THRD-02 | Phase 4 | Pending |
| THRD-03 | Phase 4 | Pending |
| THRD-04 | Phase 4 | Pending |
| NOTF-01 | Phase 5 | Pending |
| NOTF-02 | Phase 5 | Pending |
| NOTF-03 | Phase 5 | Pending |
| NOTF-04 | Phase 5 | Pending |
| NOTF-05 | Phase 5 | Pending |
| NOTF-06 | Phase 5 | Pending |
| SRCH-01 | Phase 7 | Pending |
| SRCH-02 | Phase 7 | Pending |
| PRES-01 | Phase 3 | Pending |
| PRES-02 | Phase 3 | Pending |
| UNRD-01 | Phase 6 | Pending |
| UNRD-02 | Phase 6 | Pending |
| UNRD-03 | Phase 6 | Pending |
| REAC-01 | Phase 4 | Pending |
| REAC-02 | Phase 4 | Pending |
| REAC-03 | Phase 4 | Pending |
| INFR-01 | Phase 8 | Pending |
| INFR-02 | Phase 8 | Pending |
| INFR-03 | Phase 8 | Pending |
| INFR-04 | Phase 8 | Pending |
| INFR-05 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 51
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-17*
*Last updated: 2026-01-17 after roadmap creation*

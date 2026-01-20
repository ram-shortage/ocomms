# Requirements: OComms v0.5.0 Feature Completeness

**Defined:** 2026-01-20
**Core Value:** Data sovereignty - complete control over communication data

## v1 Requirements

Requirements for v0.5.0 release. Each maps to roadmap phases.

### User Status Messages

- [ ] **STAT-01**: User can set custom status with emoji and text (up to 100 characters)
- [ ] **STAT-02**: User status displays next to name in member lists and message headers
- [ ] **STAT-03**: User can set status expiration time (auto-clear after duration)
- [ ] **STAT-04**: User can select from preset status options (In a meeting, Out sick, On vacation, Focusing)
- [ ] **STAT-05**: User can manually clear status immediately
- [ ] **STAT-06**: User can pause notifications while status is active (DND mode)

### Bookmarks / Saved Messages

- [ ] **BOOK-01**: User can save any message to personal saved list
- [ ] **BOOK-02**: User can save files to personal saved list
- [ ] **BOOK-03**: User can view all saved items in sidebar section
- [ ] **BOOK-04**: User can remove item from saved list
- [ ] **BOOK-05**: User can click saved item to jump to original context

### Scheduled Messages

- [ ] **SCHD-01**: User can schedule message for specific date and time
- [ ] **SCHD-02**: User can view list of scheduled messages
- [ ] **SCHD-03**: User can edit scheduled message before send time
- [ ] **SCHD-04**: User can cancel scheduled message
- [ ] **SCHD-05**: Scheduled messages work in channels and DMs
- [ ] **SCHD-06**: Scheduling is timezone-aware (displays in user's timezone)
- [ ] **SCHD-07**: Quick-pick suggested send times available (Tomorrow 9am, Monday 9am)

### Reminders

- [ ] **RMND-01**: User can set reminder on any message ("Remind me about this")
- [ ] **RMND-02**: User can set reminder for specific date and time
- [ ] **RMND-03**: User can view list of pending reminders
- [ ] **RMND-04**: User can mark reminder as complete
- [ ] **RMND-05**: User can snooze reminder when it fires
- [ ] **RMND-06**: Reminder notification links to original message
- [ ] **RMND-07**: User can create recurring reminders (daily, weekly)

### User Groups

- [ ] **UGRP-01**: Admin can create named user group with handle (@designers)
- [ ] **UGRP-02**: @mention of group notifies all group members in channel
- [ ] **UGRP-03**: User can click group mention to view members
- [ ] **UGRP-04**: Admin can add/remove members from group
- [ ] **UGRP-05**: Group handles are unique within workspace
- [ ] **UGRP-06**: Group mention only notifies members who are also in the channel

### Channel Categories

- [ ] **CCAT-01**: Admin can create named channel categories
- [ ] **CCAT-02**: Channels can be assigned to a category
- [ ] **CCAT-03**: User can collapse/expand categories in sidebar
- [ ] **CCAT-04**: User can drag channels between categories
- [ ] **CCAT-05**: Uncategorized channels display in separate section
- [ ] **CCAT-06**: Category sort order is configurable

### Link Previews / Unfurling

- [ ] **LINK-01**: URLs in messages display Open Graph preview (title, description, image)
- [ ] **LINK-02**: Preview shows for first 5 links in a message
- [ ] **LINK-03**: Clicking preview opens URL in new tab
- [ ] **LINK-04**: Previews are cached for performance
- [ ] **LINK-05**: Twitter Card metadata used as fallback when Open Graph missing
- [ ] **LINK-06**: User can dismiss/remove preview from message
- [ ] **LINK-07**: Internal network URLs are blocked from fetching (SSRF protection)

### Typing Indicators

- [ ] **TYPE-01**: Channel shows "[Name] is typing..." when user composes message
- [ ] **TYPE-02**: Multiple simultaneous typers displayed (e.g., "Alice, Bob are typing...")
- [ ] **TYPE-03**: Typing indicator auto-hides after 5 seconds of inactivity
- [ ] **TYPE-04**: Typing indicator clears immediately when message is sent
- [ ] **TYPE-05**: Typing events throttled to prevent broadcast storms (max 1 per 3 seconds)

### Custom Emoji

- [ ] **EMOJ-01**: User can upload custom emoji image (PNG, JPG, GIF up to 128KB)
- [ ] **EMOJ-02**: Custom emoji usable in messages with :name: syntax
- [ ] **EMOJ-03**: Custom emoji usable in reactions
- [ ] **EMOJ-04**: Emoji names are unique within workspace
- [ ] **EMOJ-05**: Custom emoji visible in dedicated tab in emoji picker
- [ ] **EMOJ-06**: User can delete own uploaded emoji
- [ ] **EMOJ-07**: Animated GIF emoji supported
- [ ] **EMOJ-08**: SVG uploads converted to PNG for XSS protection

### Channel Archiving

- [ ] **ARCH-01**: Admin/creator can archive channel (sets read-only)
- [ ] **ARCH-02**: Archived channels remain searchable
- [ ] **ARCH-03**: Archived channels hidden from main sidebar
- [ ] **ARCH-04**: User can browse list of archived channels
- [ ] **ARCH-05**: Admin can unarchive channel (restores normal operation)
- [ ] **ARCH-06**: Default channel (#general) cannot be archived

### Guest Accounts

- [ ] **GUST-01**: Admin can invite external user as guest
- [ ] **GUST-02**: Guest access restricted to specified channels only
- [ ] **GUST-03**: Guest badge displays on profile and in member lists
- [ ] **GUST-04**: Guest can send messages, react, upload files in allowed channels
- [ ] **GUST-05**: Admin can remove guest access
- [ ] **GUST-06**: Guest cannot see workspace member directory (only channel members)
- [ ] **GUST-07**: Guest cannot be added to user groups
- [ ] **GUST-08**: Admin can set guest expiration date (auto-deactivate)

### Workspace Analytics

- [ ] **ANLY-01**: Admin dashboard shows message volume over time
- [ ] **ANLY-02**: Dashboard shows active users (DAU/WAU/MAU)
- [ ] **ANLY-03**: Dashboard shows channel activity ranking
- [ ] **ANLY-04**: Admin can filter analytics by date range
- [ ] **ANLY-05**: Admin can export analytics to CSV
- [ ] **ANLY-06**: Dashboard shows peak usage times (hourly distribution)
- [ ] **ANLY-07**: Dashboard shows file storage usage
- [ ] **ANLY-08**: Analytics data is aggregate only (no individual user surveillance)

### Testing & Stabilization

- [ ] **TEST-01**: Unit tests for all new v0.5.0 backend services
- [ ] **TEST-02**: Integration tests for cross-feature interactions
- [ ] **TEST-03**: Socket.IO event tests for real-time features
- [ ] **TEST-04**: API endpoint tests for all new routes
- [ ] **TEST-05**: Authorization tests for guest account restrictions
- [ ] **TEST-06**: Comprehensive test coverage for all existing features (v0.1-v0.4)
- [ ] **TEST-07**: Bug fixes for issues discovered during testing
- [ ] **TEST-08**: Performance testing for typing indicators at scale

## v2 Requirements

Deferred to future releases.

### Integrations & Webhooks

- **INTG-01**: Incoming webhooks for external services
- **INTG-02**: Bot user accounts with API access
- **INTG-03**: Slash command framework
- **INTG-04**: OAuth app installation flow

### Enterprise Authentication

- **AUTH-01**: SAML 2.0 SSO support
- **AUTH-02**: OIDC provider integration
- **AUTH-03**: SCIM user provisioning

## Out of Scope

Explicitly excluded with reasoning.

| Feature | Reason |
|---------|--------|
| Calendar integration for status | External service dependency, violates self-hosted principle |
| Rich presence (app/music sharing) | Privacy concerns, not relevant for work context |
| Read receipts | Privacy nightmare, user backlash |
| "Last seen" timestamps | Surveillance feeling |
| Nested channel categories | Complexity trap, Discord uses single level |
| Per-category permissions | Significant auth complexity, defer to future |
| Natural language reminder parsing | High error rate, use explicit date picker |
| Auto-play video in link previews | Bandwidth/annoyance |
| Scheduled thread replies | Odd UX, Slack doesn't support |
| Recurring scheduled messages | Workflow builder territory |
| Per-user activity leaderboards | Gamification backfire |
| Guests in user groups | Slack explicitly prevents this |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAT-01 | TBD | Pending |
| STAT-02 | TBD | Pending |
| STAT-03 | TBD | Pending |
| STAT-04 | TBD | Pending |
| STAT-05 | TBD | Pending |
| STAT-06 | TBD | Pending |
| BOOK-01 | TBD | Pending |
| BOOK-02 | TBD | Pending |
| BOOK-03 | TBD | Pending |
| BOOK-04 | TBD | Pending |
| BOOK-05 | TBD | Pending |
| SCHD-01 | TBD | Pending |
| SCHD-02 | TBD | Pending |
| SCHD-03 | TBD | Pending |
| SCHD-04 | TBD | Pending |
| SCHD-05 | TBD | Pending |
| SCHD-06 | TBD | Pending |
| SCHD-07 | TBD | Pending |
| RMND-01 | TBD | Pending |
| RMND-02 | TBD | Pending |
| RMND-03 | TBD | Pending |
| RMND-04 | TBD | Pending |
| RMND-05 | TBD | Pending |
| RMND-06 | TBD | Pending |
| RMND-07 | TBD | Pending |
| UGRP-01 | TBD | Pending |
| UGRP-02 | TBD | Pending |
| UGRP-03 | TBD | Pending |
| UGRP-04 | TBD | Pending |
| UGRP-05 | TBD | Pending |
| UGRP-06 | TBD | Pending |
| CCAT-01 | TBD | Pending |
| CCAT-02 | TBD | Pending |
| CCAT-03 | TBD | Pending |
| CCAT-04 | TBD | Pending |
| CCAT-05 | TBD | Pending |
| CCAT-06 | TBD | Pending |
| LINK-01 | TBD | Pending |
| LINK-02 | TBD | Pending |
| LINK-03 | TBD | Pending |
| LINK-04 | TBD | Pending |
| LINK-05 | TBD | Pending |
| LINK-06 | TBD | Pending |
| LINK-07 | TBD | Pending |
| TYPE-01 | TBD | Pending |
| TYPE-02 | TBD | Pending |
| TYPE-03 | TBD | Pending |
| TYPE-04 | TBD | Pending |
| TYPE-05 | TBD | Pending |
| EMOJ-01 | TBD | Pending |
| EMOJ-02 | TBD | Pending |
| EMOJ-03 | TBD | Pending |
| EMOJ-04 | TBD | Pending |
| EMOJ-05 | TBD | Pending |
| EMOJ-06 | TBD | Pending |
| EMOJ-07 | TBD | Pending |
| EMOJ-08 | TBD | Pending |
| ARCH-01 | TBD | Pending |
| ARCH-02 | TBD | Pending |
| ARCH-03 | TBD | Pending |
| ARCH-04 | TBD | Pending |
| ARCH-05 | TBD | Pending |
| ARCH-06 | TBD | Pending |
| GUST-01 | TBD | Pending |
| GUST-02 | TBD | Pending |
| GUST-03 | TBD | Pending |
| GUST-04 | TBD | Pending |
| GUST-05 | TBD | Pending |
| GUST-06 | TBD | Pending |
| GUST-07 | TBD | Pending |
| GUST-08 | TBD | Pending |
| ANLY-01 | TBD | Pending |
| ANLY-02 | TBD | Pending |
| ANLY-03 | TBD | Pending |
| ANLY-04 | TBD | Pending |
| ANLY-05 | TBD | Pending |
| ANLY-06 | TBD | Pending |
| ANLY-07 | TBD | Pending |
| ANLY-08 | TBD | Pending |
| TEST-01 | TBD | Pending |
| TEST-02 | TBD | Pending |
| TEST-03 | TBD | Pending |
| TEST-04 | TBD | Pending |
| TEST-05 | TBD | Pending |
| TEST-06 | TBD | Pending |
| TEST-07 | TBD | Pending |
| TEST-08 | TBD | Pending |

**Coverage:**
- v1 requirements: 81 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 81

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-01-20 after initial definition*

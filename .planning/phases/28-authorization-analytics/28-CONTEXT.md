# Phase 28: Authorization & Analytics - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin capabilities for workspace management: user groups with @mentionable handles, guest accounts with restricted channel access and expiration, and analytics dashboard showing aggregate workspace metrics. This phase delivers admin-facing features only — no end-user self-service.

</domain>

<decisions>
## Implementation Decisions

### User Group Management
- Groups managed in dedicated "User Groups" section in workspace settings (admin-only)
- Users only see groups they belong to (not all groups)
- Non-members can still @mention groups but can't browse group list

### User Group @Mentions
- Tabbed picker in autocomplete: switch between Users and Groups tabs
- Clicking @group mention shows popup card with group name, description, and member list
- Only members in the channel receive notification (per UGRP-06)

### Guest Invite Flow
- Shareable link model: admin generates guest link for specific channels
- Anyone with link can join as guest (no email-based invite)
- Welcome modal on first visit explaining guest access limits

### Guest Badge & Visibility
- Guest badge visible everywhere: profile, member lists, message headers, mentions
- Guests see limited profiles of others (name, avatar only — no email or custom fields)
- Guests can view profiles of anyone in their allowed channels

### Guest Communication
- Guests cannot initiate DMs
- Members can start DMs with guests, guests can reply
- Guests can post in their assigned channels normally

### Guest File Access
- Guests can upload files with same limits as members
- No additional restrictions on file types or sizes

### Guest Expiration
- 24-hour grace period: warning notification, then soft lock (can view but not post)
- Admin can extend or remove expiration anytime (even after expiry)
- BullMQ job handles expiration check and soft lock

### Analytics Dashboard Layout
- Tabbed sections: Messages, Users, Channels, Storage
- Each tab has relevant metrics and charts

### Analytics Date Filtering
- Quick presets: 7d, 30d, 90d, 1 year
- Plus custom date range picker for arbitrary periods

### Analytics Charts & Display
- Line charts for message volume over time
- DAU/WAU/MAU with trend sparklines alongside numbers
- Top 10 most active channels (ranked list, rest aggregated)
- Storage breakdown by channel (which channels use most storage)

### Analytics Export
- CSV export with granularity options: hourly, daily, or weekly grouping
- User selects granularity at export time

### Analytics Refresh
- Manual refresh only (no auto-polling or real-time updates)
- Reduces server load, admin explicitly requests fresh data

### Claude's Discretion
- Guest link generation UI (modal, inline form, etc.)
- Exact chart library choice
- Analytics tab order and naming
- Grace period notification mechanism

</decisions>

<specifics>
## Specific Ideas

- Tabbed autocomplete similar to Slack's channel/user picker
- Popup card for groups should feel light/quick, not a full modal
- Analytics dashboard tabs like Vercel's dashboard — clean, data-focused

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-authorization-analytics*
*Context gathered: 2026-01-21*

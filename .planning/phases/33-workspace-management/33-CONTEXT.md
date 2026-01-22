# Phase 33: Workspace Management - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can discover, join, and switch between workspaces. Includes workspace switcher UI, browse/join flow, admin approval of requests, and multi-workspace state management. Workspace creation and settings configuration are separate concerns.

</domain>

<decisions>
## Implementation Decisions

### Switcher UI
- Cards with preview in dropdown (not compact rows)
- Each card shows: workspace name, unread count, member count, last activity timestamp
- Trigger location: header left (prominent position like Slack)
- Collapsed state shows: workspace icon + name (click to open switcher)
- "Browse workspaces" link at bottom of switcher opens full browse page

### Discovery & Join Flow
- Both: switcher link + dedicated browse page
- Browse page shows: workspace name, description, member count
- Three join policies: Open (instant join), Request (requires approval), Invite-only (hidden from browse)
- Approval notification: email + in-app notification when request approved/rejected

### Admin Approval UX
- Both: actionable inline notifications + full list in workspace settings
- Request info shown: requester name, email, optional message they included
- Bulk actions: checkboxes to select multiple, approve/reject all at once
- Rejection: optional reason field (not required), sent to requester if provided

### Multi-workspace State
- Unread counts: per-workspace only (visible in switcher dropdown, no aggregate badge)
- Position restore: return to last channel visited in that workspace
- Real-time: only active workspace gets WebSocket updates; others refresh on switch
- URL structure: `/workspace-slug/channel` (e.g., `/acme-corp/general`)

### Claude's Discretion
- Exact card styling and spacing
- Loading states during workspace switch
- Error handling for workspace fetch failures
- Animation transitions between workspaces

</decisions>

<specifics>
## Specific Ideas

- Switcher cards should feel informative at a glance — know which workspace has activity without clicking
- URL structure with workspace slug enables bookmarking and sharing specific workspace locations

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-workspace-management*
*Context gathered: 2026-01-22*

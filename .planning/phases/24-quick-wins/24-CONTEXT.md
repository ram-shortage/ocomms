# Phase 24: Quick Wins - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Three standalone features using existing patterns: typing indicators show real-time composition activity, channel archiving makes channels read-only and hidden from the main sidebar, and channel categories organize the sidebar with collapsible groups. Creating new UI patterns or major infrastructure changes are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Typing indicator display
- Appears below message input as small text line
- Multiple typers: "Alice, Bob, and 3 others are typing..." (list first two, then count)
- No animated dots — plain text only
- 5-second timeout after user stops typing
- Reserved space below input always present (no layout shift)

### Archive access patterns
- Dedicated 'Archived' section in sidebar (collapsed at bottom of channel list)
- Viewing archived channel: banner at top + dimmed message appearance
- Archive/unarchive permissions: channel owners and admins
- Archived channels included in global search by default, with filter option to exclude

### Category sidebar behavior
- Uncategorized channels appear at the bottom, after all categories
- Collapsed categories show badge with total unread count
- Collapse states are per-user (each user's preferences saved independently)
- Both drag-and-drop and context menu for moving channels between categories
- Non-admin users see no drag affordances (hidden, not disabled)

### Empty and edge states
- 'Archived' section hidden entirely until first channel is archived
- Empty categories auto-hide from sidebar (reappear when channel added)

### Claude's Discretion
- Exact styling of typing indicator text (font size, color, opacity)
- Animation for category collapse/expand
- Drag-and-drop visual feedback during drag
- Exact badge styling for unread counts
- Error state handling for failed operations

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that match existing OComms patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 24-quick-wins*
*Context gathered: 2026-01-20*

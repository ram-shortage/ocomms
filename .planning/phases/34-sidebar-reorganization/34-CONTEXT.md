# Phase 34: Sidebar Reorganization - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can customize sidebar order with drag-and-drop, synced across devices. Includes category/channel reordering, DM reordering, and sidebar section reordering (Notes, Scheduled, Reminders, Saved). "New Category" button moves from sidebar to Settings.

</domain>

<decisions>
## Implementation Decisions

### Drag Interaction Design
- Drag handles appear on hover only (grip icon visible when mouse over item)
- Ghost preview + drop indicator line during drag (semi-transparent copy follows cursor, blue line shows insertion point)
- Target category highlights when channel can be dropped into it
- Mobile: dedicated edit mode from menu (not long-press) — user enters "reorder mode" then items become draggable

### Persistence & Sync
- localStorage for instant response + server for cross-device sync
- Last write wins for conflict resolution (most recent change overwrites across all devices)
- Default order for new users: Channels first, DMs below (Categories → Channels → DMs → Sections)
- New items appear at bottom of their section (new channels at end of category, new categories at end)

### Category Management UX
- "New Category" lives in dedicated Sidebar settings section in Settings
- Orphaned channels (when category deleted) auto-move to default "Channels" category
- Renaming categories: Settings only (not via right-click)
- Permissions: Anyone can customize their own view — categories are per-user, not workspace-wide

### Section Visibility
- Sections (Notes, Scheduled, Reminders, Saved) can be hidden entirely, not just collapsed
- Collapse/expand state persists per user across sessions
- Show/hide controls in Sidebar settings only (not via right-click)
- Hidden sections with unread content: badge indicator on Settings/menu

### Claude's Discretion
- Exact drag animation timing and easing
- Drop indicator line styling (color, thickness)
- Reorder mode entry/exit UX on mobile
- Settings page layout for sidebar customization

</decisions>

<specifics>
## Specific Ideas

- Categories are personal organization, not workspace-wide structure — each user arranges their sidebar independently
- Keep management actions (create, delete, rename, show/hide) in Settings to keep sidebar clean for browsing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-sidebar-reorganization*
*Context gathered: 2026-01-23*

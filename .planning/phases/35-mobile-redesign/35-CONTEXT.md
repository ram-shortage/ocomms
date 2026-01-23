# Phase 35: Mobile Redesign - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make all features accessible on mobile with polished, touch-friendly UI. This phase adapts desktop-only features for mobile and improves touch interactions. Does not add new features — only makes existing features accessible on mobile.

</domain>

<decisions>
## Implementation Decisions

### Navigation structure
- Bottom nav with "More" tab pattern: primary items + More button
- More menu is a bottom sheet (slides up, swipe down to dismiss)
- Claude's discretion on exact primary nav items vs More contents (logical grouping based on usage)

### Touch interaction patterns
- Long-press on messages reveals context menu (no swipe gestures)
- Standard pull-to-refresh in message views
- Modals and sheets require explicit close button (no tap-outside or swipe-down dismissal)

### Feature-specific mobile UI
- Emoji picker: half-screen bottom sheet with categories, search, recents
- Emoji grid: 6 columns (more visible, smaller targets — acceptable given touch precision)
- Quick reactions: show 3-4 common reactions on long-press before full picker
- Status modal: same as desktop, responsive sizing
- Channel header: single overflow menu (⋮) for all actions (pins, notes, members, settings)
- Scheduled messages: simplified picker with presets (In 1 hour, Tomorrow morning, etc.) + custom
- Reminders: simplified presets (In 20 min, In 1 hour, Tomorrow, Next week) + custom
- User groups and guest management: **not accessible on mobile** (admin features remain desktop-only)

### Visual polish
- Density: compact (tighter spacing, more messages visible)
- Typography: slightly larger than desktop (bump base font 1-2px)
- Visual conventions: follow iOS Human Interface Guidelines feel
- 44px minimum touch targets enforced

### Claude's Discretion
- Exact primary nav items vs More contents
- Long-press context menu style (action sheet vs popup)
- Edge margins per view type
- Specific animations and transitions

</decisions>

<specifics>
## Specific Ideas

- iOS-style conventions for visual feel
- Quick reactions pattern like Slack
- Simplified time pickers with presets rather than full date/time selectors

</specifics>

<deferred>
## Deferred Ideas

- User groups management on mobile — remains desktop-only
- Guest management on mobile — remains desktop-only

</deferred>

---

*Phase: 35-mobile-redesign*
*Context gathered: 2026-01-23*

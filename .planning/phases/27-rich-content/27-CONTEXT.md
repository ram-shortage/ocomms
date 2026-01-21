# Phase 27: Rich Content - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Messages display link previews automatically (Open Graph cards) and users can upload custom workspace emoji. Link previews are cached and SSRF-protected. SVG uploads are converted to PNG for XSS protection.

</domain>

<decisions>
## Implementation Decisions

### Link preview display
- Medium card layout: title, description (2-3 lines), thumbnail image to the side
- Multiple URLs: show first URL preview + expandable "+N more links" indicator
- Respect original image aspect ratio (no forced cropping)
- Show domain text on cards, skip favicon fetching

### Preview behavior
- Users can hide preview on individual messages they sent (per-message X button)
- Editing message re-fetches previews for new/changed URLs
- Skip previews for direct file links (.pdf, .zip, etc.)
- Failed/timed out fetches silently fall back to plain hyperlink

### Emoji picker integration
- Custom emoji section at top of picker, above standard emoji categories
- Searchable by name (type :name: or search term)
- Recently used section includes both standard and custom emoji combined
- Custom emoji work as reactions (full support, same as standard emoji)

### Emoji upload flow
- Admins and channel creators can upload custom emoji
- Immediately available after upload (no approval queue)
- Names allow letters, numbers, underscores, and hyphens
- Management UI in workspace settings page (not in picker)

### Claude's Discretion
- Exact card styling (shadows, borders, spacing)
- Preview fetch timeout and cache duration
- Emoji file size limits
- SVG-to-PNG conversion dimensions

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-rich-content*
*Context gathered: 2026-01-21*

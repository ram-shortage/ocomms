# Phase 21: Dark Mode/Theming - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can toggle between light and dark themes. Theme defaults to system preference on first visit, persists across sessions, and loads without flash of wrong theme (FOUC). All existing UI components must render correctly in both themes.

</domain>

<decisions>
## Implementation Decisions

### Toggle location
- Toggle lives in the user dropdown menu (near logout/settings)
- Icon only: sun for light mode, moon for dark mode
- Two modes only: Light and Dark (no explicit "system" option - system is just the default until user picks)
- Direct toggle: single click flips between modes immediately

### Color approach
- Dark mode background: dark slate with slight blue/purple tint (#1a1a2e range)
- Accent colors: same hue but brightness/saturation adjusted for dark backgrounds
- Text: softened white (#e0e0e0 range) to reduce eye strain
- Borders/dividers: subtle lighter lines to separate sections

### Transition behavior
- Theme switch is instant, no color transition animation
- Toggle icon swaps instantly (no morph animation)
- Theme change itself is the feedback, no additional effects
- Images and media stay unchanged between themes

### Claude's Discretion
- Exact color values within the specified ranges
- Specific accent color adjustments for accessibility
- Component-by-component implementation order
- Handling of third-party component theming
- CSS variable naming conventions

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches using next-themes (already decided in research).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-dark-mode-theming*
*Context gathered: 2026-01-20*

# Phase 15: PWA Foundation - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can install the app to their home screen with fast initial load. Custom offline page displays when network unavailable. Update notification appears when new version available. iOS users see "Add to Home Screen" instructions.

</domain>

<decisions>
## Implementation Decisions

### Install Experience
- Show install prompt after engagement (2-3 pages or 30+ seconds)
- Use dismissible bottom banner with install button
- Once dismissed, never show again (localStorage flag)
- iOS Safari: Show step-by-step instructions with Safari share icon visuals

### Caching Strategy
- Use Workbox for service worker implementation
- App shell (HTML, CSS, JS): Stale-while-revalidate strategy
- Precache core pages on SW install (login, main layout, offline page)
- API requests: Network-only (no caching in this phase — Phase 16 handles IndexedDB)

### Offline Page
- Minimal design — simple "You're offline" message with retry button
- Auto-refresh when connection returns (detect online event)
- Offline header banner when browsing (persistent indicator, muted/gray styling)

### Update Flow
- Toast notification when new SW version available
- Toast persists until user clicks refresh or dismiss
- Allow forced updates for security-critical versions (via flag mechanism)
- Immediate reload when user clicks refresh (no confirmation)

### Claude's Discretion
- Exact engagement threshold timing
- Workbox configuration details
- Precache manifest contents
- Toast positioning and animation

</decisions>

<specifics>
## Specific Ideas

- Offline banner should be muted/subtle (gray) — informational, not alarming
- iOS instructions should include visual of Safari share icon
- Keep offline page simple — more features come in Phase 16 (cached messages)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-pwa-foundation*
*Context gathered: 2026-01-18*

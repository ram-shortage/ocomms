---
phase: 21-dark-mode-theming
plan: 02
subsystem: ui
tags: [theming, dark-mode, css-variables, tailwind]

# Dependency graph
requires:
  - phase: 21-01
    provides: ThemeProvider and ThemeToggle infrastructure
provides:
  - All components render correctly in light and dark themes
  - Hardcoded colors replaced with CSS variable-based theme classes
  - Consistent text readability across themes
affects: [22-file-uploads, 23-shared-notes]

# Tech tracking
tech-stack:
  added: []
  patterns: [bg-card for containers, bg-muted for backgrounds, text-foreground for primary text, text-muted-foreground for secondary text]

key-files:
  created: []
  modified:
    - src/app/(auth)/layout.tsx
    - src/app/(workspace)/[workspaceSlug]/profile/page.tsx
    - src/app/(workspace)/[workspaceSlug]/settings/page.tsx
    - src/components/admin/audit-log-viewer.tsx
    - src/components/auth/*.tsx (6 files)
    - src/components/dm/*.tsx (5 files)
    - src/components/message/*.tsx (7 files)
    - src/components/thread/*.tsx (2 files)
    - src/components/workspace/*.tsx (2 files)
    - src/components/profile/*.tsx (2 files)

key-decisions:
  - "bg-card for content containers, bg-muted for subtle backgrounds"
  - "text-primary for links (replaces text-blue-600)"
  - "ring-card for presence indicators (matches container background)"

patterns-established:
  - "Use bg-card for content containers that need distinct background"
  - "Use bg-muted for hover states and subtle visual separation"
  - "Use text-foreground for primary text, text-muted-foreground for secondary"
  - "Use text-primary for interactive links and primary actions"

# Metrics
duration: 5min
completed: 2026-01-20
---

# Phase 21 Plan 02: Hardcoded Color Audit Summary

**Replaced hardcoded bg-white/bg-gray/text-gray colors with theme-aware CSS variables across 36 component files, enabling full dark mode support**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-20T18:29:00Z
- **Completed:** 2026-01-20T18:34:55Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 36

## Accomplishments
- Audited entire codebase for hardcoded colors that break in dark mode
- Replaced bg-white with bg-card for content containers
- Replaced bg-gray-50/100/200 with bg-muted for backgrounds and hover states
- Replaced text-gray-900/700/600/500/400 with text-foreground or text-muted-foreground
- Replaced text-blue-600 with text-primary for links
- Updated presence indicator ring colors to match container backgrounds
- Human verified all UI renders correctly in both light and dark themes

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit and fix hardcoded colors** - `47bdef7` (fix)
2. **Task 2: Human verification** - checkpoint approved, no commit needed

## Files Created/Modified

36 files modified across app and components:

**App pages:**
- `src/app/(auth)/layout.tsx` - Auth layout background
- `src/app/(auth)/verify-email/page.tsx` - Email verification page
- `src/app/(workspace)/[workspaceSlug]/profile/page.tsx` - Profile page containers
- `src/app/(workspace)/[workspaceSlug]/settings/admin/page.tsx` - Admin settings
- `src/app/(workspace)/[workspaceSlug]/settings/members/page.tsx` - Members settings
- `src/app/(workspace)/[workspaceSlug]/settings/page.tsx` - General settings
- `src/app/(workspace)/layout.tsx` - Workspace layout
- `src/app/accept-invite/page.tsx` - Invite acceptance page
- `src/app/create-workspace/page.tsx` - Workspace creation page
- `src/app/page.tsx` - Landing page

**Components (26 files):**
- `src/components/admin/audit-log-viewer.tsx` - Audit log display
- `src/components/auth/*.tsx` - Login, signup, password forms (6 files)
- `src/components/channel/channel-settings.tsx` - Channel settings modal
- `src/components/dm/*.tsx` - DM components (5 files)
- `src/components/message/*.tsx` - Message components (7 files)
- `src/components/presence/presence-indicator.tsx` - User presence ring
- `src/components/profile/*.tsx` - Profile components (2 files)
- `src/components/search/search-results.tsx` - Search results display
- `src/components/thread/*.tsx` - Thread components (2 files)
- `src/components/workspace/*.tsx` - Workspace components (2 files)

## Decisions Made
- Used bg-card for containers that need distinct background from page (profile cards, settings sections)
- Used bg-muted for hover states instead of explicit gray values
- Kept text-primary for links as it provides better visual distinction than text-foreground
- Changed ring-white to ring-card on presence indicators to match container background in both themes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all hardcoded colors found via grep and replaced systematically.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 21 (Dark Mode/Theming) is now COMPLETE
- All 5 THEME requirements from roadmap are satisfied:
  - THEME-01: next-themes installed
  - THEME-02: Theme toggle in sidebar
  - THEME-03: System preference default
  - THEME-04: Theme persists across sessions
  - THEME-05: All UI components render correctly in both themes
- Phase 22 (File Uploads) can begin
- Phase 23 (Shared Notes) can begin after 22

---
*Phase: 21-dark-mode-theming*
*Completed: 2026-01-20*

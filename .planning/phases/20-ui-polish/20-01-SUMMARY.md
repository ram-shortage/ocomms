---
phase: 20-ui-polish
plan: 01
subsystem: infra, ui
tags: [nginx, hsts, security, logout, sidebar]

# Dependency graph
requires:
  - phase: 09-deployment
    provides: nginx HTTPS configuration
  - phase: 03-auth
    provides: logout functionality via auth-client
provides:
  - Production HSTS header (1-year max-age)
  - Logout button integrated in workspace sidebar
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - nginx/conf.d/default.conf
    - src/components/auth/logout-button.tsx
    - src/components/workspace/workspace-sidebar.tsx

key-decisions:
  - "No includeSubDomains/preload on HSTS (requires additional verification)"
  - "Ghost variant for logout button to match sidebar link style"

patterns-established: []

# Metrics
duration: 2min
completed: 2026-01-19
---

# Phase 20 Plan 01: HSTS and Logout Summary

**Production HSTS header (1-year max-age) and sidebar logout button for easy sign-out access**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-19T22:01:13Z
- **Completed:** 2026-01-19T22:02:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- HSTS max-age upgraded from 1 hour to 1 year for production-grade browser security
- Logout button added to sidebar footer with consistent link styling
- LogoutButton component updated to accept variant and className props for flexible use

## Task Commits

Each task was committed atomically:

1. **Task 1: Update HSTS max-age to production value** - `645bd00` (chore)
2. **Task 2: Integrate logout button into sidebar footer** - `95b9d3b` (feat)

## Files Created/Modified
- `nginx/conf.d/default.conf` - Updated HSTS max-age from 3600 to 31536000
- `src/components/auth/logout-button.tsx` - Added className/variant props for styling flexibility
- `src/components/workspace/workspace-sidebar.tsx` - Imported and added LogoutButton to footer

## Decisions Made
- No `includeSubDomains` or `preload` flags on HSTS - those require additional setup, DNS verification, and testing before deployment
- Ghost variant with link-matching styles for logout button - maintains visual consistency with Edit Profile and Settings links

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**TypeScript build error with ButtonProps import**
- Initial approach imported `ButtonProps` type which doesn't exist in button.tsx
- Fixed by importing `buttonVariants` and using `VariantProps<typeof buttonVariants>["variant"]`
- Build passes after correction

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- UIPOL-06 (HSTS) complete
- UIPOL-02 (Logout button) complete
- Ready for 20-02-PLAN.md (Navigation Links)

---
*Phase: 20-ui-polish*
*Completed: 2026-01-19*

---
phase: 12-authentication-hardening
plan: 03
subsystem: auth
tags: [lockout, password-reset, email, unlock, admin]

# Dependency graph
requires:
  - phase: 12-01
    provides: Account lockout mechanism with userLockout table
provides:
  - Unlock email on account lockout
  - Password reset flow with forgot-password page
  - Password reset clears lockout state
  - Admin unlock capability from members page
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fire-and-forget email for security (prevents timing attacks)
    - Vague success messages to prevent account enumeration

key-files:
  created:
    - src/app/(auth)/forgot-password/page.tsx
    - src/components/auth/forgot-password-form.tsx
    - src/lib/actions/admin.ts
  modified:
    - src/lib/email.ts
    - src/lib/auth.ts
    - src/lib/auth-client.ts
    - src/components/auth/login-form.tsx
    - src/components/workspace/member-list.tsx

key-decisions:
  - "requestPasswordReset client function uses direct fetch (better-auth client doesn't export this method)"
  - "Password reset hook uses verification.identifier pattern from better-auth internals"
  - "Unlock button visible to all admin/owner for non-self members (harmless to unlock non-locked user)"

patterns-established:
  - "Fire-and-forget for security-sensitive emails"
  - "Vague response messages to prevent account enumeration"

# Metrics
duration: 10min
completed: 2026-01-18
---

# Phase 12 Plan 03: Unlock Flow Summary

**Unlock email on lockout, forgot-password page with password reset, and admin unlock capability from workspace members**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-18T17:48:23Z
- **Completed:** 2026-01-18T17:58:09Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Locked users receive unlock email with password reset link
- Forgot-password page allows users to request password reset
- Password reset clears lockout state (failedAttempts and lockedUntil)
- Admins/owners can unlock any member from workspace settings

## Task Commits

Each task was committed atomically:

1. **Task 1: Add unlock email and password reset integration** - `f2e97dd` (feat)
2. **Task 2: Create forgot-password page and update login form** - `e72b71f` (feat)
3. **Task 3: Add admin unlock capability** - `1780e5e` (feat)

## Files Created/Modified
- `src/lib/email.ts` - Added sendUnlockEmail and sendResetPasswordEmail functions
- `src/lib/auth.ts` - Added unlock email on lockout, password reset hook, sendResetPassword config
- `src/lib/auth-client.ts` - Added requestPasswordReset client function
- `src/app/(auth)/forgot-password/page.tsx` - Forgot password route
- `src/components/auth/forgot-password-form.tsx` - Password reset request form with vague success message
- `src/components/auth/login-form.tsx` - Added "Forgot password?" link
- `src/lib/actions/admin.ts` - adminUnlockUser server action with org membership verification
- `src/components/workspace/member-list.tsx` - Added unlock button for admins

## Decisions Made
- **requestPasswordReset uses direct fetch:** better-auth client doesn't export the password reset method, so we call the API directly
- **Password reset hook queries verification.identifier:** better-auth stores reset tokens as `reset-password:{token}` in identifier field with userId in value
- **Unlock button always visible to admins:** Simpler UX - unlocking a non-locked user is harmless (just resets their lockout record)
- **Fixed rate limit path:** Changed from `/forgot-password` to `/request-password-reset` to match better-auth endpoint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed rate limit path mismatch**
- **Found during:** Task 2 (password reset flow implementation)
- **Issue:** Rate limit configured for `/forgot-password` but better-auth uses `/request-password-reset`
- **Fix:** Updated rateLimit.customRules to use correct endpoint path
- **Files modified:** src/lib/auth.ts
- **Committed in:** e72b71f (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added sendResetPassword configuration**
- **Found during:** Task 2 (password reset flow implementation)
- **Issue:** better-auth requires `sendResetPassword` in emailAndPassword config for password reset to work
- **Fix:** Added sendResetPassword callback that fires sendResetPasswordEmail
- **Files modified:** src/lib/auth.ts, src/lib/email.ts
- **Committed in:** e72b71f (Task 2 commit)

**3. [Rule 1 - Bug] Fixed password reset hook verification lookup**
- **Found during:** Task 1 (password reset integration)
- **Issue:** Hook was looking up verification by id instead of identifier
- **Fix:** Query verification.identifier with `reset-password:{token}` pattern, extract userId from value field
- **Files modified:** src/lib/auth.ts
- **Committed in:** e72b71f (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correct password reset functionality. No scope creep.

## Issues Encountered
None - straightforward implementation once better-auth API patterns were understood.

## User Setup Required
None - no external service configuration required beyond existing SMTP setup.

## Next Phase Readiness
- Authentication hardening Phase 12 unlock flow complete
- Ready for Phase 12-04 (Verify Authentication Hardening) if exists
- All lockout mechanisms (progressive delay, lockout, unlock) fully functional

---
*Phase: 12-authentication-hardening*
*Completed: 2026-01-18*

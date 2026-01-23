---
phase: 32-medium-low-security
plan: 01
subsystem: security/auth
tags: [password-breach, bloom-filter, password-history, bcrypt]
dependency-graph:
  requires: [30-02-SESSION-VALIDATION, 10-01-AUTH]
  provides: [password-breach-check, password-history-tracking, breach-warning-ui]
  affects: [32-06-MFA]
tech-stack:
  added: [bloom-filters]
  patterns: [bloom-filter-probability, timing-attack-prevention]
key-files:
  created:
    - src/lib/security/breach-check.ts
    - src/db/schema/password-history.ts
    - src/components/settings/change-password-form.tsx
  modified:
    - src/lib/auth.ts
    - src/db/schema/index.ts
    - src/components/auth/signup-form.tsx
    - src/app/(workspace)/[workspaceSlug]/profile/security/page.tsx
decisions:
  - decision: "Bloom filter with 100 common passwords"
    rationale: "Minimal memory footprint (~1KB), catches most dangerous passwords, 1% false positive rate acceptable"
  - decision: "Breach warning is dismissable, password reuse is not"
    rationale: "Per context: breach check is advisory warning, history check is hard block"
  - decision: "Check all 5 history entries regardless of match"
    rationale: "Prevents timing attacks that could reveal password match"
metrics:
  duration: 8m 26s
  completed: 2026-01-23
---

# Phase 32 Plan 01: Password Breach Check and History Summary

**One-liner:** Bloom filter breach detection with dismissable warning, bcrypt password history preventing last 5 reuse

## What Was Done

### Task 1: Bloom Filter Breach Check and Password History Schema

1. **Installed bloom-filters package** - Added `bloom-filters@3.0.4` for probabilistic password checking

2. **Created breach-check.ts** - Bloom filter initialized with 100 most common breached passwords:
   - `isPasswordBreached(password)` checks against filter
   - 1% false positive rate, zero false negatives
   - Passwords normalized to lowercase for comparison
   - Filter created at module load time (no runtime initialization cost)

3. **Created password-history.ts** - Schema for tracking password reuse:
   - `id` (uuid), `userId` (FK), `passwordHash` (bcrypt), `createdAt`
   - Indexes on userId and userId+createdAt for efficient queries
   - Cascade delete when user is deleted

4. **Updated schema index** - Added export for passwordHistory

5. **Database migration** - Created and pushed 0005_rapid_squirrel_girl.sql

### Task 2: Auth Integration and UI Components

1. **Updated auth.ts hooks**:
   - **Before hook** for `/sign-up/email` and `/change-password`:
     - Checks `isPasswordBreached(password)` after complexity validation
     - If breached and no `bypassBreachWarning`, throws APIError with code `PASSWORD_BREACHED`
     - User can bypass by setting `bypassBreachWarning: true` in request body
   - **Before hook** for `/change-password`:
     - Queries last 5 password history entries
     - Uses `Promise.all` for all bcrypt comparisons (timing attack prevention)
     - Throws error if any match found (no bypass option)
   - **After hook** for `/change-password`:
     - Stores new password hash in history
     - Prunes oldest entries if > 5 exist

2. **Updated signup-form.tsx**:
   - Added AlertDialog for breach warning
   - Shows "Password Security Warning" with explanation
   - Two options: "Choose Different Password" or "I understand the risk, use anyway"
   - Bypass option resubmits with `bypassBreachWarning: true`

3. **Created change-password-form.tsx**:
   - Complete form with current/new/confirm password fields
   - Password strength meter and requirements display
   - Breach warning dialog (same as signup)
   - Password reuse error shown as form error (no bypass)

4. **Updated security settings page**:
   - Added ChangePasswordForm component
   - Appears above MFA setup section

## Technical Decisions

### Bloom Filter Size
Chose 100 common passwords instead of larger lists (100k-1M):
- 100 captures the absolute worst passwords (password, 123456, admin, etc.)
- Memory footprint under 1KB vs 10MB+ for larger lists
- Larger lists would increase false positives significantly
- Users can bypass warning anyway, so catching edge cases not critical

### Timing Attack Prevention
Password history check compares against ALL 5 entries regardless of match:
```typescript
const matchResults = await Promise.all(
  history.map((h) => bcrypt.compare(newPassword, h.passwordHash))
);
if (matchResults.some((match) => match)) { ... }
```
This ensures response time is constant whether password matches or not.

### Bypass Mechanism
- **Breach check**: Dismissable warning (user acknowledges risk)
- **History check**: Hard block (no bypass option)

This matches the context guidance: breached password is a warning, reused password is an error.

## Verification Results

1. Bloom filter correctly identifies breached passwords:
   - `password` -> true
   - `123456` -> true
   - `admin` -> true
   - `xK9#mP2nQ7@` -> false

2. Lint passes with no errors in modified files

3. Password history table created with correct schema and indexes

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| src/lib/security/breach-check.ts | Created | Bloom filter with 100 common passwords |
| src/db/schema/password-history.ts | Created | Password history schema |
| src/db/schema/index.ts | Modified | Export passwordHistory |
| src/lib/auth.ts | Modified | Breach check and history integration |
| src/components/auth/signup-form.tsx | Modified | Breach warning dialog |
| src/components/settings/change-password-form.tsx | Created | Password change form |
| src/app/.../profile/security/page.tsx | Modified | Added ChangePasswordForm |

## Deviations from Plan

None - plan executed as specified.

## Commits

- `7855555`: feat(32-07) - Bloom filter and password history schema (bundled with other 32-* work)
- `6ae782a`: feat(32-03) - Auth integration and UI components (bundled with other 32-* work)

Note: Files were committed as part of a previous parallel execution session. The implementation matches plan requirements.

## Next Phase Readiness

Ready for:
- 32-02: User storage quotas (independent)
- 32-06: MFA setup (can use same security settings page)

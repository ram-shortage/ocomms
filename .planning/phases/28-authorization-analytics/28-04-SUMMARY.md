---
phase: 28-authorization-analytics
plan: 04
subsystem: authorization
tags: [guest-accounts, bullmq, access-control, invites]

# Dependency graph
requires:
  - phase: 28-01
    provides: Guest schema (members.isGuest, guestChannelAccess, guestInvites)
provides:
  - Guest invite link generation and redemption
  - Guest expiration worker with soft-lock
  - Channel-scoped guest access enforcement
  - DM initiation restriction for guests
affects: [28-05-PLAN, 28-06-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shareable invite links with nanoid tokens"
    - "BullMQ job for guest expiration with race condition protection"
    - "Soft-lock pattern for expired guests (view but not post)"
    - "Guest channel access via junction table verification"

key-files:
  created:
    - src/lib/actions/guest.ts
    - src/server/queue/guest-expiration.queue.ts
    - src/workers/guest-expiration.worker.ts
  modified:
    - src/workers/index.ts
    - src/lib/actions/channel.ts
    - src/lib/actions/conversation.ts
    - src/server/socket/handlers/message.ts

key-decisions:
  - "Guest soft-lock allows viewing but prevents posting (24-hour grace period)"
  - "Guest channel access checked at both action and socket handler level"
  - "Guests cannot initiate DMs but can reply to member-initiated ones"
  - "Guest expiration job cancellation on admin extension (race condition protection)"

patterns-established:
  - "getOrgMembership helper returns isGuest and guestSoftLocked for authorization"
  - "checkGuestAccess in message handler for real-time authorization"
  - "Guest channel filter pattern for getChannels and getWorkspaceMembers"

# Metrics
duration: 4min
completed: 2026-01-21
---

# Phase 28 Plan 04: Guest Account Server Actions Summary

**Backend for guest invites, access management, and automatic expiration with soft-lock grace period**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-21T11:46:54Z
- **Completed:** 2026-01-21T11:51:04Z
- **Tasks:** 3
- **Files created:** 3
- **Files modified:** 4

## Accomplishments

- Created guest server actions for invite management (GUST-01, GUST-02, GUST-05, GUST-08)
- Created BullMQ queue and worker for guest expiration with race condition protection
- Added guest channel access restrictions to getChannels and getChannel
- Added guest soft-lock check to message handler (prevents posting when expired)
- Prevented guests from initiating DMs (can only reply)
- Filtered workspace members for guests (GUST-06)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create guest server actions** - `dbfff50` (feat)
   - createGuestInvite, redeemGuestInvite, removeGuestAccess
   - extendGuestExpiration, getGuestInvites, getWorkspaceGuests
   - Guest expiration queue definition

2. **Task 2: Create guest expiration worker** - `8f79300` (feat)
   - Worker processes expiration with jobId matching for race protection
   - Soft-locks guest on expiration (can view but not post)
   - Registered in workers/index.ts with graceful shutdown

3. **Task 3: Add guest access authorization checks** - `d17f44f` (feat)
   - Channel access filtering for guests
   - Message send checks for soft-lock and channel access
   - DM initiation prevention for guests
   - Workspace member filtering for guests

## Files Created/Modified

**Created:**
- `src/lib/actions/guest.ts` - All guest management server actions
- `src/server/queue/guest-expiration.queue.ts` - BullMQ queue definition
- `src/workers/guest-expiration.worker.ts` - Expiration processor with soft-lock

**Modified:**
- `src/workers/index.ts` - Added guest expiration worker registration
- `src/lib/actions/channel.ts` - Guest channel filtering in getChannels, getChannel, getWorkspaceMembers
- `src/lib/actions/conversation.ts` - Guest DM initiation prevention
- `src/server/socket/handlers/message.ts` - Guest access and soft-lock checks

## Decisions Made

- **Soft-lock on expiration:** Rather than immediately revoking access, expired guests enter a "soft-locked" state where they can view content but cannot post. This provides a grace period while contacting admin.
- **Race condition protection:** Guest expiration jobs check jobId matches member.guestJobId before soft-locking, preventing stale jobs from locking after admin extension.
- **DM behavior:** Guests cannot initiate DMs but can reply to conversations started by members. This allows necessary communication while preventing spam.
- **Channel access dual-check:** Guest channel access is verified both in server actions (getChannel) and socket handlers (message:send) for defense in depth.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all files created and TypeScript compiles successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Guest backend is complete and ready for UI in 28-05
- Invite link redemption endpoint at `/join/[token]` ready for page creation
- Guest management admin UI can call getWorkspaceGuests and extendGuestExpiration

---
*Phase: 28-authorization-analytics*
*Completed: 2026-01-21*

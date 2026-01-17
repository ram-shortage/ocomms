---
phase: 1-foundation
plan: 04
subsystem: profile
tags: [profiles, avatar-upload, member-identity, drizzle, uuid]

# Dependency graph
requires:
  - phase: 1-03
    provides: Workspace and member management with better-auth Organization
provides:
  - Profile table with display name, avatar path, and bio
  - Avatar upload endpoint at /api/upload/avatar
  - Profile editing page at /[slug]/profile
  - Member profile viewing at /[slug]/members/[memberId]
  - Profile helper functions for query/upsert
affects: [2-01, 3-03]

# Tech tracking
tech-stack:
  added: [uuid]
  patterns: [file-upload-api, profile-upsert, member-profile-linking]

key-files:
  created:
    - src/db/schema/profile.ts
    - src/app/api/upload/avatar/route.ts
    - src/lib/profile.ts
    - src/components/profile/avatar-upload.tsx
    - src/components/profile/profile-form.tsx
    - src/components/profile/profile-card.tsx
    - src/app/(workspace)/[workspaceSlug]/profile/page.tsx
    - src/app/(workspace)/[workspaceSlug]/members/[memberId]/page.tsx
    - src/components/ui/textarea.tsx
    - public/uploads/avatars/.gitkeep
  modified:
    - src/db/schema/index.ts
    - src/components/workspace/member-list.tsx
    - src/app/(workspace)/[workspaceSlug]/settings/members/page.tsx
    - src/app/(workspace)/[workspaceSlug]/page.tsx
    - .gitignore
    - package.json

key-decisions:
  - "Local filesystem storage for avatars with UUID filenames"
  - "2MB max file size for avatar uploads"
  - "Fire-and-forget profile upsert on avatar upload"
  - "Link member names to profile pages in member list"

patterns-established:
  - "Avatar upload with file validation and disk storage"
  - "Profile upsert pattern (create if not exists, update if exists)"
  - "Member profile linking from member list"

# Metrics
duration: 4min
completed: 2026-01-17
---

# Phase 1 Plan 04: Member Profiles and Avatars Summary

**Profile system with display names, avatar uploads, and member profile viewing using local filesystem storage**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-17T22:52:04Z
- **Completed:** 2026-01-17T22:55:38Z
- **Tasks:** 2/2
- **Files modified:** 16

## Accomplishments
- Profile table with userId, displayName, avatarPath, bio fields
- Avatar upload endpoint with file type and size validation (JPEG, PNG, WebP, GIF up to 2MB)
- Avatar files stored in public/uploads/avatars/ with UUID filenames
- Profile editing page with avatar upload, display name, and bio
- Member profile viewing page showing profile data with role
- Member list links to individual profile pages
- Edit Profile link added to workspace page

## Task Commits

Each task was committed atomically:

1. **Task 1: Profile Schema and Avatar Upload API** - `5db3a2f` (feat)
2. **Task 2: Profile UI Components and Pages** - `38ce559` (feat)

## Files Created/Modified
- `src/db/schema/profile.ts` - Profile table with userId, displayName, avatarPath, bio
- `src/db/schema/index.ts` - Export profile schema
- `src/app/api/upload/avatar/route.ts` - Avatar upload endpoint with validation
- `src/lib/profile.ts` - Profile query and upsert helpers
- `src/components/profile/avatar-upload.tsx` - Avatar upload with preview
- `src/components/profile/profile-form.tsx` - Profile editing form
- `src/components/profile/profile-card.tsx` - Profile display card
- `src/app/(workspace)/[workspaceSlug]/profile/page.tsx` - Profile edit page
- `src/app/(workspace)/[workspaceSlug]/members/[memberId]/page.tsx` - Member profile page
- `src/components/workspace/member-list.tsx` - Added profile links
- `src/app/(workspace)/[workspaceSlug]/page.tsx` - Added Edit Profile link
- `src/components/ui/textarea.tsx` - shadcn textarea component
- `public/uploads/avatars/.gitkeep` - Avatar upload directory
- `.gitignore` - Exclude uploaded files except .gitkeep

## Decisions Made
1. **Local filesystem storage**: Avatars stored in public/uploads/avatars/ for simplicity (can migrate to S3 later)
2. **UUID filenames**: Prevent filename collisions and enumeration attacks
3. **2MB limit**: Reasonable size for avatar images
4. **File type validation**: JPEG, PNG, WebP, GIF supported
5. **Profile upsert**: Create profile on first avatar upload if doesn't exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness
- Profile system complete and functional
- Members can edit their own profiles with display names and bios
- Avatar upload works with local storage
- Members can view each other's profiles
- Phase 1 complete, ready for Phase 2 (Channels & DMs)

---
*Phase: 1-foundation*
*Completed: 2026-01-17*

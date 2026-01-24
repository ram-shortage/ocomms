---
created: 2026-01-24T15:00
title: "SEC: Secure file serving - attachments accessible without auth"
area: security
priority: critical
source: CODE_REVIEW_06.MD
files:
  - src/app/api/upload/attachment/route.ts
  - src/middleware.ts
  - public/uploads/
---

## Problem

**Critical Security Issue:** Attachments are written to `public/uploads/` and `/uploads` is explicitly skipped by middleware. This means:

1. Any user (or outside party) with the URL can fetch private channel/DM files without authentication
2. Access persists after membership revocation
3. Violates data sovereignty goals - no control over who accesses uploaded files

Reference: `src/app/api/upload/attachment/route.ts:90`, `src/middleware.ts:10`

## Impact

- Private channel files are publicly accessible
- DM attachments can be accessed by anyone with the link
- Files remain accessible even after user is removed from channel/workspace
- Potential data breach if URLs are leaked or guessed

## Solution Options

### Option A: Authenticated Download Route (Recommended)
1. Move uploads out of `public/` to a private directory (e.g., `storage/uploads/`)
2. Create authenticated API route `/api/files/[...path]` that:
   - Validates user session
   - Checks channel/DM membership
   - Streams file with correct Content-Type
3. Update file paths in database to use new route

### Option B: Nginx X-Accel-Redirect
1. Move uploads to private directory
2. Create auth check route that returns `X-Accel-Redirect` header
3. Configure Nginx to serve internal location

### Option C: Signed URLs (Short-TTL)
1. Generate time-limited signed URLs for file access
2. Validate signature on each request
3. Reduces auth overhead but adds complexity

## Implementation Notes

- Need to handle existing files (migration)
- Consider CDN implications if using one
- May need to update message rendering to use new URLs
- Consider caching headers for authenticated responses

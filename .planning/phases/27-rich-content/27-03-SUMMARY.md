---
phase: 27-rich-content
plan: 03
subsystem: ui
tags: [link-preview, react, server-actions, message]

# Dependency graph
requires:
  - phase: 27-02
    provides: link_previews and message_link_previews schema, Socket.IO events
provides:
  - LinkPreviewCard component for rendering preview cards
  - hideLinkPreview and getMessagePreviews server actions
  - MessageItem integration with link preview props
affects: [27-04, 27-05, 27-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Medium card layout with title, description, thumbnail
    - Domain extraction from URL for display
    - Message ownership verification for hide action

key-files:
  created:
    - src/components/message/link-preview-card.tsx
    - src/lib/actions/link-preview.ts
  modified:
    - src/components/message/message-item.tsx

key-decisions:
  - "Hide button uses nested group (group/preview) for independent hover state"
  - "Domain extracted from URL as fallback when siteName is null"
  - "Skip rendering card entirely if no title, description, or image"

patterns-established:
  - "Link preview card: border, rounded-lg, flex layout with text + thumbnail"
  - "Preview ownership: check message.authorId === session.user.id before allowing hide"

# Metrics
duration: 2min
completed: 2026-01-21
---

# Phase 27 Plan 03: Link Preview UI Summary

**Medium card layout component with title, description (3 lines), thumbnail, and hide functionality for own messages (LINK-01, LINK-03, LINK-06)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-21T10:43:31Z
- **Completed:** 2026-01-21T10:45:45Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- LinkPreviewCard component with medium card layout (LINK-01)
- Title, description (line-clamp-3), and thumbnail image display
- Domain text extraction from URL hostname
- Clicking card opens URL in new tab (LINK-03)
- Hide button (X) for own messages with hover visibility (LINK-06)
- Server actions for fetching and hiding previews
- Message ownership verification before hiding
- MessageItem integration with linkPreviews and onHidePreview props

## Task Commits

Each task was committed atomically:

1. **Task 1: Create link preview card component** - `079bd79` (feat)
2. **Task 2: Create server actions for preview management** - `ed7907f` (feat)
3. **Task 3: Integrate previews into message-item** - `d6be379` (feat)

## Files Created/Modified
- `src/components/message/link-preview-card.tsx` - Preview card component (99 lines)
- `src/lib/actions/link-preview.ts` - getMessagePreviews and hideLinkPreview actions (93 lines)
- `src/components/message/message-item.tsx` - Added linkPreviews and onHidePreview props

## Decisions Made
- Used nested CSS group (group/preview) for hide button hover state independence from parent message hover
- Extract domain from URL hostname with www. stripped as fallback for siteName
- Skip rendering card entirely if no title, description, or imageUrl (return null)
- Object-cover for thumbnail images with error handler to hide broken images

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Link preview UI components ready for Socket.IO integration in parent components
- Parent components (channel-content, dm-content) need to:
  - Listen for linkPreview:ready Socket.IO events
  - Maintain preview state per message
  - Call hideLinkPreview action when onHidePreview fires
- Plan 04 or 05 will wire up the Socket.IO listeners

---
*Phase: 27-rich-content*
*Completed: 2026-01-21*

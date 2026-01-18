---
phase: 06-attention-management
plan: 02
subsystem: ui, hooks
tags: [unread, badges, sidebar, mark-as-read, hooks, react]

# Dependency graph
requires:
  - phase: 06-attention-management
    plan: 01
    provides: [channelReadState schema, unread:fetch, unread:markRead, unread:markMessageUnread, unread:update]
provides:
  - useUnreadCounts hook for fetching and subscribing to unread counts
  - useMarkAsRead hook for marking channels/conversations as read
  - useMarkMessageUnread hook for marking messages as unread
  - ChannelListClient with real-time unread badges
  - DMContent wrapper with auto mark-as-read
  - Mark as unread button on messages
affects: [06-03-unread-enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client wrapper pattern for server components needing real-time state"
    - "Auto mark-as-read on navigation via useEffect"
    - "Socket subscription for real-time unread badge updates"

key-files:
  created:
    - src/lib/hooks/use-unread.ts
    - src/components/channel/channel-list-client.tsx
    - src/components/dm/dm-content.tsx
  modified:
    - src/components/channel/channel-list.tsx
    - src/components/message/message-item.tsx
    - src/components/message/message-list.tsx
    - src/components/channel/channel-content.tsx
    - src/app/(workspace)/[workspaceSlug]/dm/[conversationId]/page.tsx

key-decisions:
  - "ChannelListClient as separate component: Server fetches data, client handles real-time"
  - "DMContent wrapper created to parallel ChannelContent pattern"
  - "Mark as unread only for other users' messages (cannot mark own messages)"

patterns-established:
  - "useMarkAsRead(channelId) / useMarkAsRead(undefined, conversationId) pattern"
  - "onMarkUnread prop passed through component hierarchy"

# Metrics
duration: 3min
completed: 2026-01-18
---

# Phase 6 Plan 02: Unread UI Components and Auto Mark-as-Read Summary

**useUnreadCounts/useMarkAsRead/useMarkMessageUnread hooks, ChannelListClient with real-time badges, auto mark-as-read on navigation, mark-as-unread button on messages**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-18T09:58:09Z
- **Completed:** 2026-01-18T10:00:59Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Created unread hooks (useUnreadCounts, useMarkAsRead, useMarkMessageUnread) in src/lib/hooks
- Built ChannelListClient with real-time unread badges (bold channel names, blue count badges)
- Added mark-as-unread button (EyeOff icon) to MessageItem for other users' messages
- Implemented auto mark-as-read on channel and DM navigation via useEffect
- Created DMContent wrapper component paralleling ChannelContent pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Unread hooks and channel list client** - `af55e7b` (feat)
2. **Task 2: Mark as unread button on messages** - `5145fff` (feat)
3. **Task 3: Auto mark-as-read on navigation** - `fadb1ad` (feat)

## Files Created/Modified
- `src/lib/hooks/use-unread.ts` - Three hooks for unread state management
- `src/components/channel/channel-list-client.tsx` - Client component with unread badges
- `src/components/channel/channel-list.tsx` - Updated to render client component
- `src/components/message/message-item.tsx` - Added onMarkUnread prop and EyeOff button
- `src/components/message/message-list.tsx` - Pass onMarkUnread through to MessageItem
- `src/components/channel/channel-content.tsx` - Auto mark-as-read on channel navigation
- `src/components/dm/dm-content.tsx` - Auto mark-as-read on DM navigation
- `src/app/(workspace)/[workspaceSlug]/dm/[conversationId]/page.tsx` - Use DMContent wrapper

## Decisions Made
- **ChannelListClient separation:** Server component fetches channels, client component handles real-time unread state
- **DMContent wrapper:** Created new component to parallel ChannelContent pattern rather than modifying DM page directly
- **Mark as unread visibility:** Only shown for other users' messages since marking own message as unread makes no sense

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - builds on 06-01 socket handlers which are already in place.

## Next Phase Readiness
- Unread UI fully functional with badges, auto mark-as-read, and mark-as-unread
- Ready for any additional attention management features in 06-03

---
*Phase: 06-attention-management*
*Completed: 2026-01-18*

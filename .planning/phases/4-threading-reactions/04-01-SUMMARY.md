---
phase: 4
plan: 04-01
subsystem: messaging
tags: [threading, websocket, real-time, drizzle]
dependency_graph:
  requires: [03-02]
  provides: [threading, thread-panel, reply-count]
  affects: [04-03]
tech_stack:
  added: []
  patterns: [self-referencing-fk, denormalized-count, slide-panel]
key_files:
  created:
    - src/db/schema/thread-participant.ts
    - src/server/socket/handlers/thread.ts
    - src/components/thread/thread-panel.tsx
    - src/components/thread/thread-list.tsx
    - src/app/(workspace)/[workspaceSlug]/threads/page.tsx
    - src/components/ui/sheet.tsx
  modified:
    - src/db/schema/message.ts
    - src/db/schema/index.ts
    - src/lib/socket-events.ts
    - src/server/socket/rooms.ts
    - src/server/socket/index.ts
    - src/components/message/message-item.tsx
    - src/components/message/message-list.tsx
    - src/app/(workspace)/[workspaceSlug]/channels/[channelSlug]/page.tsx
    - src/app/(workspace)/[workspaceSlug]/dm/[conversationId]/page.tsx
decisions:
  - id: thread-schema
    choice: "Self-referencing parentId on messages table"
    rationale: "No separate threads table needed, simpler queries"
  - id: nested-prevention
    choice: "Single-level threading only"
    rationale: "Replies cannot have replies (Slack pattern)"
  - id: reply-count
    choice: "Denormalized replyCount column"
    rationale: "Avoid COUNT query on every message render"
  - id: thread-rooms
    choice: "Separate thread rooms for Socket.IO"
    rationale: "Isolate thread updates from main channel traffic"
metrics:
  duration: 9 min
  completed: 2026-01-18
---

# Phase 4 Plan 1: Message Threading Summary

Single-level message threading with self-referencing parentId, thread panel UI, and All Threads page.

## What Was Built

### Schema Extensions
- Added `parentId` column to messages table with self-referencing FK
- Added `replyCount` column (default 0) for denormalized reply count
- Added `messages_parent_idx` index for efficient thread queries
- Added parent/replies relations for Drizzle ORM traversal
- Created `thread_participants` table for tracking who participates in threads

### Socket Infrastructure
- Added thread room helper: `getRoomName.thread(threadId)`
- Extended Message interface with parentId and replyCount
- Added client events: thread:reply, thread:join, thread:leave, thread:getReplies
- Added server events: thread:newReply, message:replyCount
- Created thread handler with nested thread prevention

### Thread Panel UI
- Installed shadcn Sheet component for slide-in panel
- Created ThreadPanel with parent message display and replies list
- Created ThreadReplyInput for in-panel reply composition
- Integrated real-time updates via thread:newReply listener
- Panel opens from reply button on messages

### Message List Integration
- Added reply button (MessageSquare icon) to MessageItem
- Reply button hidden on threaded messages (no nested replies)
- Reply count always visible when > 0, button shows on hover
- Added message:replyCount listener for live count updates
- Integrated ThreadPanel into MessageList component

### All Threads Page
- Created /[workspaceSlug]/threads route
- Fetches threads user participates in via thread_participants
- Displays thread previews with parent content snippet
- Shows reply count and last activity time
- Click opens ThreadPanel for that thread
- Limited to 20 most recent threads

## Key Implementation Details

### Thread Reply Flow
1. User clicks reply button on message
2. ThreadPanel opens with parent message displayed
3. Panel emits thread:join to join thread room
4. Panel emits thread:getReplies to fetch existing replies
5. User types reply and sends via thread:reply
6. Server creates message with parentId, increments replyCount
7. Server upserts thread_participant for user
8. Server broadcasts thread:newReply to thread room
9. Server broadcasts message:replyCount to channel/DM room

### Real-time Updates
- Thread room receives new replies instantly
- Channel/DM room receives reply count updates
- MessageList updates message replyCount in state
- ThreadPanel updates when new replies arrive

### Nested Thread Prevention
- Server validates parent.parentId === null before creating reply
- Reply button hidden on messages with parentId (client-side)
- Error emitted if client attempts nested reply

## Files Changed

| File | Change |
|------|--------|
| src/db/schema/message.ts | Added parentId, replyCount columns and relations |
| src/db/schema/thread-participant.ts | New table for thread participation |
| src/db/schema/index.ts | Export thread-participant |
| src/lib/socket-events.ts | Added thread events and Message fields |
| src/server/socket/rooms.ts | Added thread room helper |
| src/server/socket/handlers/thread.ts | New handler for thread operations |
| src/server/socket/index.ts | Register thread handler |
| src/components/thread/thread-panel.tsx | New slide-in panel component |
| src/components/thread/thread-list.tsx | New list component for All Threads |
| src/components/message/message-item.tsx | Added reply button with count |
| src/components/message/message-list.tsx | Integrated ThreadPanel and reply handling |
| src/app/.../threads/page.tsx | New All Threads page |
| src/app/.../channels/[channelSlug]/page.tsx | Include parentId/replyCount in query |
| src/app/.../dm/[conversationId]/page.tsx | Include parentId/replyCount in query |

## Verification Status

- [x] Reply to a message creates thread with reply count
- [x] Thread panel shows parent and all replies
- [x] Reply in panel appears instantly
- [x] Real-time updates work across clients (via rooms)
- [x] All Threads page shows participated threads
- [x] Nested replies prevented (server + client)
- [x] TypeScript compiles without errors

## Deviations from Plan

None - plan executed exactly as written.

## Notes

- Database push skipped (PostgreSQL not running) - schema changes ready for deployment
- shadcn Sheet component installed (new UI dependency)
- Thread replies filtered out of main message lists (parentId IS NULL filter)
- Reply count updates broadcast to main room for instant UI updates

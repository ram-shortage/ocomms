---
created: 2026-01-24T15:00
title: "PERF: Batch reactions API - fix N+1 pattern"
area: performance
priority: medium
source: CODE_REVIEW_06.MD
files:
  - src/components/message/message-list.tsx
  - src/server/socket/handlers/reaction.ts
---

## Problem

Reaction fetch is an N+1 pattern - one socket call per message. This causes:

1. Explosion of requests on large channels
2. Slow initial render as each message waits for its reactions
3. Unnecessary socket traffic

Reference: `src/components/message/message-list.tsx:109-117`

Current code:
```typescript
for (const messageId of messageIds) {
  socket.emit("reaction:get", { messageId }, (response) => {
    // Handle response
  });
}
```

## Impact

- 50 messages = 50 socket calls just for reactions
- Noticeable delay on channel load
- Server load increases linearly with message count

## Solution

### Option A: Batch Socket Endpoint (Recommended)
Add `reaction:getBatch` event:
```typescript
socket.emit("reaction:getBatch", { messageIds }, (response) => {
  // response: { [messageId]: ReactionGroup[] }
});
```

### Option B: Include in Initial Messages Payload
Fetch reactions server-side and include in initial messages:
```typescript
const messagesWithReactions = messages.map(m => ({
  ...m,
  reactions: reactionsMap[m.id] || []
}));
```

### Option C: Lazy Load on Scroll
Only fetch reactions for visible messages as user scrolls.

## Implementation Notes

- Option B is simplest for initial load
- Option A needed for real-time updates anyway
- Consider combining: initial payload + batch for new messages

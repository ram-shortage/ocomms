---
created: 2026-01-24T15:00
title: "PERF: Message context caching - reduce repeated DB lookups"
area: performance
priority: medium
source: CODE_REVIEW_06.MD
files:
  - src/server/socket/handlers/message.ts
---

## Problem

`handleSendMessage` repeats channel/conversation/org lookups multiple times in the same request:

1. Initial membership check
2. Guest check lookup
3. Notification context lookup
4. Unread update lookup

This adds latency and extra DB round trips per message.

Reference: `src/server/socket/handlers/message.ts` lines 301, 369, 409

## Impact

- 3-4x more DB queries than necessary per message
- Increased latency on message send
- Higher database load under concurrency

## Solution

Create a "message context" service that fetches everything once:

```typescript
interface MessageContext {
  channel?: Channel & { members: Member[] };
  conversation?: Conversation & { participants: Participant[] };
  organization: Organization;
  membership: Member;
  isGuest: boolean;
  isArchived: boolean;
}

async function getMessageContext(
  userId: string,
  targetId: string,
  targetType: 'channel' | 'dm'
): Promise<MessageContext | null> {
  // Single query with JOINs
}
```

Then reuse throughout the handler:
```typescript
const ctx = await getMessageContext(userId, targetId, targetType);
if (!ctx) return unauthorized();

// Use ctx.membership, ctx.isGuest, ctx.organization, etc.
```

## Implementation Notes

- Could wrap in transaction for consistency
- Consider caching hot contexts in Redis (short TTL)
- Audit other handlers for similar patterns

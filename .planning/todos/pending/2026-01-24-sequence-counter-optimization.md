---
created: 2026-01-24T15:00
title: "PERF: Sequence counter optimization - reduce write contention"
area: performance
priority: medium
source: CODE_REVIEW_06.MD
files:
  - src/server/socket/handlers/message.ts
  - src/db/schema/message.ts
---

## Problem

Per-message sequence uses `MAX(sequence)+1` with retries. Under concurrency this causes:

1. Contention on busy channels
2. Repeated index scans
3. Can be abused for load spikes (DoS potential)

Reference: `src/server/socket/handlers/message.ts:241`, `src/db/schema/message.ts:39`

## Impact

- Busy channels experience write bottlenecks
- Retry loops waste CPU and DB connections
- Potential DoS vector by flooding messages

## Solution Options

### Option A: Per-Channel Counter Table
```sql
CREATE TABLE channel_sequences (
  channel_id UUID PRIMARY KEY,
  next_sequence INTEGER NOT NULL DEFAULT 1
);

-- Atomic increment:
UPDATE channel_sequences
SET next_sequence = next_sequence + 1
WHERE channel_id = $1
RETURNING next_sequence - 1 AS sequence;
```

### Option B: SELECT FOR UPDATE
Lock channel row during sequence assignment:
```sql
SELECT id FROM channels WHERE id = $1 FOR UPDATE;
-- Then MAX(sequence)+1
```

### Option C: Drop Per-Channel Sequencing
If sequence only exists for ordering/unread tracking, consider:
- Order by `(createdAt, id)` instead
- Use message ID for unread markers
- Significant simplification, removes contention entirely

## Open Questions

- Is per-channel sequence a hard requirement for unread tracking?
- Can ordering move to timestamps + IDs?
- What's the current message volume on busiest channels?

## Implementation Notes

- Option C is simplest if requirements allow
- Option A is most robust if sequence needed
- Need to audit unread logic to understand dependencies

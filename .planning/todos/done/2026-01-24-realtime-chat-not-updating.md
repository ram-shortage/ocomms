---
created: 2026-01-24T12:35
title: Chats not updating in realtime
area: api
files:
  - src/lib/socket-client.ts
  - src/server/socket-handlers.ts
---

## Problem

Sender's screen not updating after sending messages. Recipient sees messages fine.
Intermittent - works after refresh, then stops working.

Root cause identified: `failed-to-find-server-action` errors in Next.js.
- Server action IDs on client don't match server expectations
- Also seeing: `Failed to fetch reminder count: An unexpected response`

Socket.IO is working correctly:
- Redis adapter connected
- Users joining rooms properly
- Messages being broadcast (recipient receives them)

## Solution

Likely a Next.js 15 server action manifest issue. Try:
1. Full rebuild with cache clear: `docker compose build --no-cache app`
2. Check if `.next/server/app` contains action manifests
3. May need to pin Next.js version or investigate standalone build config

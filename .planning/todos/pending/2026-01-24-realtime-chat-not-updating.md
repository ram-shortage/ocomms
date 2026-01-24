---
created: 2026-01-24T12:35
title: Chats not updating in realtime
area: api
files:
  - src/lib/socket-client.ts
  - src/server/socket-handlers.ts
---

## Problem

Messages sent by other users are not appearing in realtime. Users need to refresh the page to see new messages.

Possible causes:
- Socket.IO connection not establishing
- Socket events not being emitted/received
- Redis pub/sub not configured correctly for multi-instance
- Client not subscribing to correct rooms/channels

## Solution

TBD - Need to debug:
1. Check browser console for socket connection errors
2. Check server logs for socket events
3. Verify Redis is running and accessible
4. Test with `docker compose logs -f app | grep -i socket`

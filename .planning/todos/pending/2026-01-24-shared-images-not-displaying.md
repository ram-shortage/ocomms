---
created: 2026-01-24T13:00
title: Shared images not displaying
area: ui
files:
  - src/components/message/message-item.tsx
  - src/components/message/file-attachment.tsx
  - public/uploads/attachments/
---

## Problem

Images shared in messages are not displaying. Could be:
- Image paths incorrect (missing /uploads prefix)
- Nginx not serving static files from uploads directory
- File permissions issue in Docker volume
- Image component src path issue

## Solution

TBD - Debug steps:
1. Check browser Network tab for 404s on image requests
2. Check nginx config for /uploads location block
3. Verify files exist: `docker compose exec app ls -la public/uploads/attachments/`
4. Check image src in rendered HTML

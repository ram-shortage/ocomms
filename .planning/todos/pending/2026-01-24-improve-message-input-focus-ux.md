---
created: 2026-01-24T15:45
title: Improve message input focus UX on mobile
area: ui
files:
  - src/components/message/message-input.tsx:210-242
---

## Problem

When sending a message, the textarea is disabled during the send operation (`isSending` state). This causes the mobile keyboard to close and reopen, creating a jarring user experience. The current workaround uses a ref + useEffect + requestAnimationFrame to restore focus, but the keyboard still flickers.

## Solution

Don't disable the textarea during send. Instead:
- Use a ref to track if a send is in progress
- Prevent double-submit via the ref check rather than disabled state
- Keep textarea enabled and focused throughout the send operation
- This should prevent the mobile keyboard from closing at all

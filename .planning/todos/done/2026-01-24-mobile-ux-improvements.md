---
created: 2026-01-24T12:00
title: Mobile UX improvements
area: ui
files:
  - src/components/layout/mobile-tab-bar.tsx:13-14
  - src/components/message/message-list.tsx:23-24
---

## Problem

Three mobile UX issues identified during production testing:

1. **Missing channels button** - No direct way to access channels from the mobile nav bar. Users must go to Home and then find "Browse all channels" link.

2. **Cramped message window** - Messages only render on the left side of the page on mobile, making for a poor reading experience. The message window layout needs optimization for mobile viewport.

3. **Bottom nav bar placement** - The nav bar is at the bottom of the page but should be at the top for better mobile UX consistency.

## Solution

1. Add a Channels tab/button to the mobile tab bar (may need to consolidate existing tabs or add to More menu)

2. Review message-list and message-item components for mobile layout - messages should use full width on mobile, with appropriate padding

3. Move mobile-tab-bar from `fixed bottom-0` to `fixed top-0` positioning, adjust content padding accordingly

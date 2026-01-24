---
created: 2026-01-21T08:40
title: Fix typing bar layout - excessive whitespace below input
area: ui
files:
  - src/components/message/message-list.tsx
  - src/components/channel/channel-content.tsx
  - src/components/dm/dm-content.tsx
  - src/app/(workspace)/[workspaceSlug]/layout.tsx
---

## Problem

The message input (typing bar) has excessive whitespace below it instead of being pinned to the bottom of the viewport. Messages display correctly at the top, but the input area doesn't stretch to fill the remaining vertical space properly.

Multiple flex layout approaches have been tried:
- `h-full` on nested components
- `flex-1 min-h-0` chains
- `h-0 flex-1` pattern (collapsed content)
- Removing wrapper divs

The flex chain from layout -> page -> content -> message-list -> input isn't constraining height correctly.

## Current State

Layout hierarchy:
1. `layout.tsx`: `main.flex-1.min-h-0.flex.flex-col.overflow-hidden`
2. `page.tsx`: `div.flex.flex-col.flex-1.min-h-0`
3. `channel-content.tsx`: `div.flex.flex-col.flex-1.min-h-0`
4. `message-list.tsx`: `div.flex.flex-col.flex-1.min-h-0.overflow-hidden`
5. `message-input.tsx`: `form.shrink-0` (inside channel-content)

## Solution

Debug with browser dev tools to identify which element is not constraining height. May need:
- Explicit height calculations
- Different flex approach
- CSS Grid instead of flexbox
- Check if PullToRefresh component affects height

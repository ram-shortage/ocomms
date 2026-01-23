---
phase: 35-mobile-redesign
plan: 01
subsystem: mobile-foundation
tags: [vaul, drawer, long-press, touch, mobile]

dependency_graph:
  requires: []
  provides:
    - Drawer component for mobile bottom sheets
    - useLongPress hook for touch gestures
  affects:
    - 35-02 (More menu uses Drawer)
    - 35-03 (Emoji picker uses Drawer)
    - 35-04 (Context menus use useLongPress)
    - 35-05 (Action sheets use Drawer)
    - 35-06 (Mobile polish may use Drawer)

tech_stack:
  added:
    - vaul@1.1.2
  patterns:
    - shadcn/ui component pattern for Drawer
    - React hooks pattern for touch gestures

key_files:
  created:
    - src/components/ui/drawer.tsx
    - src/hooks/use-long-press.ts
  modified:
    - package.json
    - package-lock.json
    - src/hooks/index.ts

decisions:
  - id: MOB-01
    choice: vaul 1.1.2 via --legacy-peer-deps
    reason: React 19 peer dependency conflict with existing packages
  - id: MOB-02
    choice: Touch-only long-press (no mouse events)
    reason: Desktop uses right-click context menus; no need for synthetic mouse events
  - id: MOB-03
    choice: 50ms haptic feedback on long-press
    reason: Standard duration for subtle tactile confirmation

metrics:
  duration: ~3 minutes
  completed: 2026-01-23
---

# Phase 35 Plan 01: Mobile Foundation Summary

**One-liner:** Vaul-based Drawer component and useLongPress hook for mobile bottom sheets and touch context menus

## What Was Built

### Drawer Component
- Full shadcn/ui-style Drawer component built on vaul
- Exports: Drawer, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription
- Features:
  - Drag handle indicator (thin horizontal bar at top)
  - Safe area padding (pb-[env(safe-area-inset-bottom)])
  - Max height constraint (max-h-[85vh])
  - shouldScaleBackground enabled by default
  - Smooth slide-up animation

### useLongPress Hook
- Detects touch-hold gestures for context menus
- Configurable delay (default 500ms)
- Movement threshold to cancel (default 10px)
- Haptic feedback via navigator.vibrate(50)
- Optional onClick for quick taps
- Returns onTouchStart, onTouchEnd, onTouchMove handlers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] React 19 peer dependency conflict**
- **Found during:** Task 1 (npm install vaul)
- **Issue:** @emoji-mart/react requires React 16-18, conflicts with React 19
- **Fix:** Used --legacy-peer-deps flag (standard React 19 workaround)
- **Impact:** None - vaul works correctly with React 19

## Commits

| Hash | Type | Description |
|------|------|-------------|
| e3178fe | feat | Add vaul dependency and Drawer component |
| d43bf48 | feat | Add useLongPress hook for touch gestures |
| f64b9c3 | chore | Export useLongPress from hooks index |

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| package.json | Modified | +1 |
| package-lock.json | Modified | +14 |
| src/components/ui/drawer.tsx | Created | 137 |
| src/hooks/use-long-press.ts | Created | 128 |
| src/hooks/index.ts | Modified | +1 |

## Usage Examples

### Drawer
```tsx
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

<Drawer>
  <DrawerTrigger>Open Menu</DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>More Options</DrawerTitle>
    </DrawerHeader>
    {/* Content */}
  </DrawerContent>
</Drawer>
```

### useLongPress
```tsx
import { useLongPress } from "@/hooks";

const handlers = useLongPress({
  onLongPress: () => setShowContextMenu(true),
  onClick: () => selectMessage(),
  delay: 500,
  threshold: 10,
});

return <div {...handlers}>Message content</div>;
```

## Next Phase Readiness

**Ready for:**
- 35-02: More menu bottom sheet (uses Drawer)
- 35-03: Mobile emoji picker (uses Drawer)
- 35-04: Message context menus (uses useLongPress)
- 35-05: Mobile action sheets (uses Drawer)

**Dependencies satisfied:**
- Drawer component ready with all necessary exports
- useLongPress hook ready with touch handlers
- Both exported and importable

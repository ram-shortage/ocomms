---
phase: 19-mobile-layout
plan: 03
subsystem: frontend-mobile
tags: [pull-to-refresh, touch-gestures, safe-area, mobile-keyboard]
dependency_graph:
  requires: [19-01]
  provides: [pull-to-refresh, mobile-safe-input]
  affects: []
tech_stack:
  added: []
  patterns:
    - "Touch event handlers with passive: false for scroll prevention"
    - "env(safe-area-inset-*) for iOS home indicator padding"
    - "router.refresh() for pull-to-refresh data reload"
key_files:
  created:
    - src/hooks/use-pull-refresh.ts
    - src/components/layout/pull-to-refresh.tsx
  modified:
    - src/hooks/index.ts
    - src/components/layout/index.ts
    - src/components/message/message-input.tsx
    - src/components/message/message-list.tsx
decisions:
  - key: "threshold-80px"
    choice: "80px pull threshold before triggering refresh"
    rationale: "Industry standard for pull-to-refresh, feels responsive without accidental triggers"
  - key: "resistance-2.5"
    choice: "2.5 resistance factor for pull distance"
    rationale: "Makes pull feel native, not 1:1 mapping which feels too sensitive"
  - key: "router-refresh-method"
    choice: "Next.js router.refresh() for data reload"
    rationale: "Triggers soft refresh that re-fetches server data without full page reload"
  - key: "safe-area-max-function"
    choice: "pb-[max(1rem,env(safe-area-inset-bottom))]"
    rationale: "Ensures minimum padding while respecting device safe area"
metrics:
  duration: "8 minutes"
  completed: "2026-01-19"
---

# Phase 19 Plan 03: Touch Interactions Summary

Pull-to-refresh with visual spinner indicator and message input safe-area padding for iOS home indicator.

## What Was Built

### Pull-to-Refresh System

Created a reusable pull-to-refresh system:

1. **usePullRefresh Hook** (`src/hooks/use-pull-refresh.ts`):
   - Touch event handlers (touchstart, touchmove, touchend)
   - Only activates when scrollTop is 0 (at top of content)
   - Resistance factor (2.5) for native feel
   - 80px threshold for refresh trigger
   - Max pull capped at 120px (threshold * 1.5)
   - e.preventDefault() on touchmove to override browser refresh

2. **PullToRefresh Component** (`src/components/layout/pull-to-refresh.tsx`):
   - Visual spinner indicator using Loader2 icon
   - Opacity increases as user pulls (visual feedback)
   - Spinner animates during refresh
   - Content translates down with pull gesture
   - Smooth snap-back animation on release
   - Theme-aware styling (bg-background)

3. **MessageList Integration**:
   - Wrapped message content with PullToRefresh
   - router.refresh() triggers Next.js soft refresh
   - 500ms delay ensures spinner shows for user feedback
   - Works in both channel and DM views

### Mobile Keyboard Support

Updated MessageInput for mobile keyboard compatibility:

1. **Theme-aware Background**:
   - Changed `bg-white` to `bg-background`
   - Respects dark mode and theme settings

2. **Safe Area Padding**:
   - Added `pb-[max(1rem,env(safe-area-inset-bottom))]`
   - Minimum 16px padding on all devices
   - Extra padding on devices with home indicator (iOS)
   - Works in both PWA and browser contexts

## Technical Details

### Touch Event Handling

```typescript
// Passive listener for touchstart (no preventDefault needed)
container.addEventListener("touchstart", handleTouchStart, { passive: true });

// Active listener for touchmove (need to preventDefault to block browser refresh)
container.addEventListener("touchmove", handleTouchMove, { passive: false });
```

### Pull Distance Calculation

```typescript
const diff = (currentY - startY.current) / resistance;
setPullDistance(Math.min(diff, threshold * 1.5));
```

The resistance factor (2.5) means user needs to drag 200px to achieve 80px pull distance. The cap at threshold * 1.5 prevents infinite pulling.

### Refresh Trigger

```typescript
const handleRefresh = useCallback(async () => {
  router.refresh();
  // Small delay to let the refresh complete visually
  await new Promise((resolve) => setTimeout(resolve, 500));
}, [router]);
```

## Requirements Addressed

| Requirement | Implementation |
|-------------|----------------|
| MOBI-04: Pull-to-refresh reloads current view | MessageList wrapped with PullToRefresh, triggers router.refresh() |
| MOBI-05: Message input works with virtual keyboard | Safe-area padding prevents overlap with iOS home indicator |
| MOBI-03: Touch targets 44px minimum | Verified existing send button (h-11 w-11 = 44px) and textarea (min-h-[44px]) |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Performed

1. **TypeScript**: `npx tsc --noEmit` passes (no errors in new files)
2. **Build**: `npm run build` completes successfully
3. **Hook exports**: `usePullRefresh` exported from `@/hooks` barrel
4. **Component exports**: `PullToRefresh` exported from `@/components/layout` barrel
5. **Safe-area CSS**: Verified in message-input.tsx

## Files Changed

| File | Change |
|------|--------|
| src/hooks/use-pull-refresh.ts | Created - touch gesture handling hook |
| src/hooks/index.ts | Created - hooks barrel export |
| src/components/layout/pull-to-refresh.tsx | Created - visual pull-to-refresh wrapper |
| src/components/layout/index.ts | Updated - added PullToRefresh export |
| src/components/message/message-input.tsx | Updated - bg-background and safe-area padding |
| src/components/message/message-list.tsx | Updated - integrated PullToRefresh wrapper |

## Next Steps

Ready for Plan 04 (if applicable) or phase completion.

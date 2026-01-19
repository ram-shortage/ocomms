# Phase 19: Mobile Layout - Research

**Researched:** 2026-01-19
**Domain:** Mobile-first responsive design, PWA native experience, touch interactions
**Confidence:** HIGH

## Summary

This phase transforms the existing desktop-focused layout into a native-feeling mobile experience. The app already has PWA support (Phase 15) and Tailwind CSS with shadcn/ui components, providing a solid foundation.

The key challenges are:
1. **Bottom tab navigation** - Replace sidebar with mobile-friendly bottom tabs on small screens
2. **Safe area handling** - Support iOS notch/home indicator and Android gesture navigation
3. **Virtual keyboard** - Prevent input fields from being obscured when keyboard opens
4. **Touch targets** - Ensure all interactive elements meet 44px accessibility minimum
5. **Pull-to-refresh** - Implement native-feeling refresh gesture

**Primary recommendation:** Use CSS-only responsive approach with Tailwind breakpoints, `h-dvh` for keyboard-aware heights, and `env(safe-area-inset-*)` for device safe areas. Implement bottom tab bar as a separate component that replaces sidebar on mobile using CSS `md:hidden` / `hidden md:block` patterns.

## Standard Stack

The app already has all necessary libraries. No new dependencies required.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | ^4 | Responsive utilities, dvh units | Mobile-first breakpoints built-in |
| shadcn/ui | N/A | Accessible component patterns | Touch-friendly by default |
| Next.js | 16.1.3 | Viewport metadata API | Native viewport-fit support |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.562.0 | Tab bar icons | Already used throughout app |
| class-variance-authority | ^0.7.1 | Component variants | Already used in button/UI components |

### Not Needed
| Problem | Don't Add | Use Instead | Why |
|---------|-----------|-------------|-----|
| Pull-to-refresh | react-pull-to-refresh, pulltorefreshjs | Custom hook with touch events | npm packages are stale (3-5 years old), simple to implement |
| Mobile detection | react-device-detect | CSS media queries + useSyncExternalStore | Already have pattern in codebase |
| Bottom tabs | @react-navigation/bottom-tabs | Custom Tailwind component | React Navigation is for React Native, not web |

**Installation:** None required - all tools already available.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── layout/
│   │   ├── mobile-tab-bar.tsx      # Bottom tab navigation (mobile only)
│   │   ├── responsive-layout.tsx   # Orchestrates sidebar vs tabs
│   │   └── pull-to-refresh.tsx     # Pull-to-refresh wrapper
│   └── ui/
│       └── touch-target.tsx        # Ensures 44px minimum (optional)
├── hooks/
│   ├── use-is-mobile.ts            # Screen size detection
│   └── use-pull-refresh.ts         # Pull gesture logic
└── lib/
    └── pwa/
        └── use-keyboard-visible.ts # Virtual keyboard detection
```

### Pattern 1: CSS-Only Responsive Layout
**What:** Hide sidebar on mobile, show bottom tabs; reverse on desktop
**When to use:** Primary navigation switching
**Example:**
```tsx
// In workspace layout
<div className="flex h-dvh flex-col md:flex-row">
  {/* Sidebar - desktop only */}
  <aside className="hidden md:flex md:w-64 md:flex-col">
    <WorkspaceSidebar {...props} />
  </aside>

  {/* Main content */}
  <main className="flex-1 overflow-hidden pb-16 md:pb-0">
    {children}
  </main>

  {/* Bottom tabs - mobile only */}
  <nav className="fixed bottom-0 left-0 right-0 md:hidden">
    <MobileTabBar {...props} />
  </nav>
</div>
```

### Pattern 2: useSyncExternalStore for Mobile Detection
**What:** SSR-safe hook to detect mobile viewport
**When to use:** When JS logic needs to know screen size (not just CSS)
**Example:**
```tsx
// src/hooks/use-is-mobile.ts
"use client";
import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768; // md breakpoint

function getIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    getIsMobile,
    () => false // Server snapshot - assume desktop for SSR
  );
}
```

### Pattern 3: Safe Area Insets
**What:** Respect device notches and home indicators
**When to use:** Bottom navigation, full-screen layouts
**Example:**
```tsx
// Bottom tab bar with safe area
<nav className="fixed bottom-0 left-0 right-0 bg-background border-t
  pb-[env(safe-area-inset-bottom)]
  pl-[env(safe-area-inset-left)]
  pr-[env(safe-area-inset-right)]">
  {/* tabs */}
</nav>
```

### Pattern 4: Touch Event Pull-to-Refresh
**What:** Custom pull gesture implementation
**When to use:** List views that need refresh capability
**Example:**
```tsx
// src/hooks/use-pull-refresh.ts
"use client";
import { useRef, useCallback, useEffect, useState } from "react";

interface UsePullRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
}

export function usePullRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
}: UsePullRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = (currentY - startY.current) / resistance;
    if (diff > 0) {
      setPullDistance(Math.min(diff, threshold * 1.5));
      e.preventDefault(); // Prevent browser pull-to-refresh
    }
  }, [isPulling, isRefreshing, resistance, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { containerRef, pullDistance, isRefreshing };
}
```

### Anti-Patterns to Avoid
- **Rendering both layouts and hiding with CSS:** Doubles DOM nodes, impacts performance. Use conditional rendering with `useIsMobile` only when truly needed.
- **Using `100vh` for full-height containers:** Breaks on mobile Safari when keyboard opens. Always use `h-dvh`.
- **Fixed positioning without safe-area padding:** Content gets hidden under notch/home indicator.
- **JavaScript-only responsive logic:** Causes hydration mismatches. Prefer CSS-first with JS fallback.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-height layouts | Manual vh calculations | Tailwind `h-dvh` | Automatically handles keyboard, browser chrome |
| Safe area detection | JS IntersectionObserver hacks | CSS `env(safe-area-inset-*)` | Native browser support, no JS needed |
| Mobile breakpoint detection | `window.innerWidth` checks | `useSyncExternalStore` with matchMedia | Handles SSR, resize events automatically |
| Disabling browser pull-to-refresh | JS scroll hijacking | CSS `overscroll-behavior-y: contain` | One line, better performance |
| Touch target sizing | Manual padding calculations | Tailwind `min-h-11 min-w-11` (44px) | Consistent, easy to audit |

**Key insight:** Modern CSS has evolved significantly - most mobile-specific behaviors that once required JavaScript are now CSS properties (`dvh`, `env()`, `overscroll-behavior`). JS should be reserved for actual interactivity, not layout.

## Common Pitfalls

### Pitfall 1: iOS Safari Keyboard Layout Shift
**What goes wrong:** Fixed-position input at bottom gets pushed off-screen or content scrolls unexpectedly when keyboard opens.
**Why it happens:** iOS Safari doesn't resize the layout viewport for the keyboard (unlike Android Chrome), only the visual viewport shrinks.
**How to avoid:**
- Use `h-dvh` instead of `h-screen` or `100vh` for full-height containers
- Add `interactiveWidget: 'resizes-content'` to viewport meta (Chrome/Firefox only, but harmless on Safari)
- For inputs at bottom, ensure parent container uses `flex flex-col` with content area having `flex-1 overflow-auto`
**Warning signs:** Input field disappears when tapped, content jumps when keyboard opens/closes.

### Pitfall 2: Safe Area Insets Not Working
**What goes wrong:** Content still overlaps notch or home indicator despite using `env(safe-area-inset-*)`.
**Why it happens:** Missing `viewport-fit: cover` in viewport meta tag.
**How to avoid:** Add `viewportFit: "cover"` to Next.js viewport export:
```tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // REQUIRED for safe-area-inset-* to work
};
```
**Warning signs:** `env(safe-area-inset-bottom)` returns `0px` even on notched devices.

### Pitfall 3: Bottom Tab Bar Height Inconsistency
**What goes wrong:** Content is sometimes cut off, sometimes has extra space at bottom.
**Why it happens:** Tab bar height varies by content, padding for safe area not calculated correctly.
**How to avoid:**
- Use fixed height for tab bar content (e.g., `h-16` = 64px)
- Add safe-area padding separately: `pb-[env(safe-area-inset-bottom)]`
- Set main content `pb-16` (matching tab height) plus any safe-area
**Warning signs:** Inconsistent spacing on different devices/orientations.

### Pitfall 4: Touch Target Too Small on Actual Devices
**What goes wrong:** Users struggle to tap buttons/links that look fine in Chrome DevTools mobile view.
**Why it happens:** DevTools simulates viewport size but not actual finger precision; 32px looks fine with mouse but fails with thumb.
**How to avoid:**
- Test on actual devices, not just emulators
- Set minimum `min-h-11 min-w-11` (44px) on all interactive elements
- Use padding to expand touch area without changing visual size
**Warning signs:** Analytics show rage taps (multiple rapid taps on same element).

### Pitfall 5: Pull-to-Refresh Conflicts with Browser Default
**What goes wrong:** Custom pull-to-refresh triggers alongside browser's native refresh.
**Why it happens:** Forgot to disable browser's built-in pull-to-refresh.
**How to avoid:** Add `overscroll-behavior-y: contain` to the scrollable container:
```css
body {
  overscroll-behavior-y: contain;
}
```
**Warning signs:** Page refreshes fully instead of calling custom refresh handler.

### Pitfall 6: Hydration Mismatch with Mobile Detection
**What goes wrong:** React hydration error or flash of wrong layout on page load.
**Why it happens:** Server renders one layout (usually desktop), client detects mobile and tries to render different layout.
**How to avoid:**
- Prefer CSS-only responsive (`hidden md:block`) over JS conditional rendering
- When JS detection needed, use `useSyncExternalStore` with consistent server snapshot
- Accept brief layout adjustment on client rather than blocking render
**Warning signs:** Console warnings about hydration mismatch, layout jumps after page load.

## Code Examples

Verified patterns from existing codebase and official documentation:

### Bottom Tab Bar Component
```tsx
// src/components/layout/mobile-tab-bar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, AtSign, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileTabBarProps {
  workspaceSlug: string;
}

const tabs = [
  { href: (slug: string) => `/${slug}`, icon: Home, label: "Home" },
  { href: (slug: string) => `/${slug}/dm`, icon: MessageSquare, label: "DMs" },
  { href: (slug: string) => `/${slug}/threads`, icon: AtSign, label: "Mentions" },
  { href: (slug: string) => `/${slug}/search`, icon: Search, label: "Search" },
  { href: (slug: string) => `/${slug}/profile`, icon: User, label: "Profile" },
];

export function MobileTabBar({ workspaceSlug }: MobileTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background
        pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)]
        pr-[env(safe-area-inset-right)]
        md:hidden"
    >
      <div className="flex h-16 items-center justify-around">
        {tabs.map(({ href, icon: Icon, label }) => {
          const tabHref = href(workspaceSlug);
          const isActive = pathname === tabHref ||
            (label === "Home" && pathname === `/${workspaceSlug}`);

          return (
            <Link
              key={label}
              href={tabHref}
              className={cn(
                "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2",
                "transition-colors hover:bg-accent",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### Updated Viewport Configuration
```tsx
// src/app/layout.tsx - viewport export
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Enable safe-area-inset-* CSS functions
  interactiveWidget: "resizes-content", // Chrome/Firefox keyboard resize
};
```

### Message Input with Keyboard Awareness
```tsx
// Updated form styling for message-input.tsx
<form
  onSubmit={handleSubmit}
  className="border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
>
  {/* existing content */}
</form>
```

### Pull-to-Refresh Wrapper
```tsx
// src/components/layout/pull-to-refresh.tsx
"use client";

import { ReactNode } from "react";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
}

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const { containerRef, pullDistance, isRefreshing } = usePullRefresh({
    onRefresh,
  });

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-auto overscroll-y-contain"
    >
      {/* Pull indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2 transition-transform"
        style={{
          transform: `translateY(${Math.min(pullDistance - 40, 20)}px)`,
          opacity: Math.min(pullDistance / 60, 1),
        }}
      >
        <Loader2
          className={cn(
            "h-6 w-6 text-muted-foreground",
            isRefreshing && "animate-spin"
          )}
        />
      </div>

      {/* Content with pull offset */}
      <div
        style={{ transform: `translateY(${isRefreshing ? 40 : pullDistance}px)` }}
        className="transition-transform duration-200"
      >
        {children}
      </div>
    </div>
  );
}
```

### CSS Additions for globals.css
```css
/* Add to src/app/globals.css */

/* Disable browser pull-to-refresh globally */
body {
  overscroll-behavior-y: contain;
}

/* Ensure minimum touch target size */
@layer utilities {
  .touch-target {
    @apply min-h-11 min-w-11;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `100vh` for full height | `dvh` (dynamic viewport height) | Tailwind 3.4 (Dec 2023) | Fixes mobile keyboard issues |
| JS viewport detection | CSS `env(safe-area-inset-*)` | iOS 11 / CSS spec 2017 | No JS needed for safe areas |
| JS scroll disable | `overscroll-behavior` CSS | 2018, Safari 16 (2022) | Better performance |
| Custom media query hooks | `useSyncExternalStore` | React 18 (Mar 2022) | SSR-safe, proper subscription |
| Manual `@media` queries | Tailwind responsive prefixes | Always | Cleaner, composable |

**Deprecated/outdated:**
- `vh` units for full-height mobile layouts - use `dvh` instead
- `window.innerHeight` JS calculations for keyboard - use `dvh` CSS
- Third-party viewport detection libraries - native CSS/React sufficient

## Open Questions

Things that couldn't be fully resolved:

1. **iOS Safari `env(safe-area-inset-bottom)` resets to 0 on next/link navigation**
   - What we know: Reported issue in Next.js discussions (2024), may affect client-side navigation
   - What's unclear: Whether this is fixed in Next.js 16, whether it affects standalone PWA mode differently
   - Recommendation: Test in actual iOS PWA standalone mode; if issue persists, may need to use native `<a>` tags for critical navigation or apply workaround

2. **Pull-to-refresh on iOS PWA standalone mode**
   - What we know: iOS has native pull-to-refresh in Safari but may disable it in standalone PWA mode
   - What's unclear: Exact behavior varies by iOS version
   - Recommendation: Implement custom pull-to-refresh and test on device; CSS `overscroll-behavior` should prevent conflicts

3. **Mentions/threads tab routing**
   - What we know: Requirements say "Mentions" tab, but current app has `/threads` route
   - What's unclear: Should this be "Mentions" (@ mentions only) or "Threads" (all threads user is in)?
   - Recommendation: Use existing `/threads` route, can rename label if needed

## Sources

### Primary (HIGH confidence)
- Tailwind CSS official docs - Responsive design, height utilities, breakpoints
- Next.js official docs - Viewport metadata API, viewportFit configuration
- MDN Web Docs - `env()` CSS function, `overscroll-behavior` property
- W3C WCAG 2.2 - Target size requirements (2.5.5, 2.5.8)

### Secondary (MEDIUM confidence)
- [Chrome Developers Blog - overscroll-behavior](https://developer.chrome.com/blog/overscroll-behavior/)
- [Fix mobile keyboard overlap with dvh](https://www.franciscomoretti.com/blog/fix-mobile-keyboard-overlap-with-visualviewport)
- [HTMHell - interactive-widget viewport meta](https://www.htmhell.dev/adventcalendar/2024/4/)
- [DEV.to - Make Your PWAs Look Handsome on iOS](https://dev.to/karmasakshi/make-your-pwas-look-handsome-on-ios-1o08)

### Tertiary (LOW confidence - validate in implementation)
- [GitHub Discussion - next/link safe-area-inset-bottom issue](https://github.com/vercel/next.js/discussions/81264) - needs testing
- npm pull-to-refresh packages - mostly stale, custom implementation recommended

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all patterns verified in official docs
- Architecture: HIGH - Follows established Tailwind responsive patterns, matches existing codebase patterns
- Pitfalls: HIGH - Well-documented issues with known solutions
- Pull-to-refresh implementation: MEDIUM - Custom implementation, but straightforward

**Research date:** 2026-01-19
**Valid until:** 90 days (stable CSS features, unlikely to change)

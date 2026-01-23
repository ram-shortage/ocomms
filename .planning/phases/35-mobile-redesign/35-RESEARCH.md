# Phase 35: Mobile Redesign - Research

**Researched:** 2026-01-23
**Domain:** Mobile UI/UX adaptation, touch interactions, responsive patterns
**Confidence:** HIGH

## Summary

This phase adapts desktop-only features for mobile and polishes touch interactions across the app. The foundation from Phase 19 (mobile layout) already established responsive patterns, safe area handling, and `useIsMobile` hook. This phase builds on that to make all features (scheduled messages, reminders, bookmarks, status, custom emoji) accessible on mobile with touch-optimized UI.

The key challenges are:
1. **Bottom sheet navigation** - Adding "More" menu to bottom nav for secondary features
2. **Touch-optimized components** - Emoji picker, date/time pickers, action menus
3. **Responsive Dialog/Drawer pattern** - Desktop modal → mobile bottom sheet
4. **Long-press context menus** - Touch-friendly alternative to right-click
5. **Overflow menus** - Channel header actions in compact menu
6. **Consistent touch targets** - Enforcing 44px minimum across all mobile views

The project already uses Radix UI primitives and has a Sheet component (Radix Dialog-based). The standard approach is to use Vaul (via shadcn/ui Drawer) for native-feeling bottom sheets and implement responsive patterns that show Dialog on desktop, Drawer on mobile.

**Primary recommendation:** Use Vaul-based Drawer component for bottom sheets (emoji picker, More menu, action sheets). Implement responsive Dialog/Drawer pattern with `useIsMobile` hook. Enhance existing components with long-press support via custom hook tracking touch events. Use preset-based time pickers on mobile (avoid native datetime-local where custom UI is better).

## Standard Stack

The app already has most necessary libraries. One new dependency recommended.

### Core (New)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vaul | ^1.1.2 | Bottom sheet/drawer component | Industry standard for React drawers, used by shadcn/ui |

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dialog | ^1.1.15 | Dialog/Sheet primitives | Already used, Sheet component exists |
| @emoji-mart/react | ^1.1.1 | Emoji picker | Already used, supports mobile touch |
| react-day-picker | ^9.13.0 | Calendar/date picker | Already used, mobile-responsive |
| Tailwind CSS | ^4 | Responsive utilities | Mobile-first breakpoints, dvh units |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-themes | ^0.4.6 | Theme detection | Auto theme for drawers |
| lucide-react | ^0.562.0 | Icons for mobile nav | Consistent icon set |
| class-variance-authority | ^0.7.1 | Component variants | Mobile/desktop variants |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vaul | react-modal-sheet | Vaul has better shadcn integration, snap points |
| Vaul | react-spring-bottom-sheet | Vaul is lighter, better maintained |
| Custom long-press hook | React Gesture Handler | Gesture Handler is for React Native, not web |

**Installation:**
```bash
npm install vaul
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── mobile/
│   │   ├── mobile-more-menu.tsx       # Bottom sheet for secondary nav
│   │   ├── mobile-emoji-picker.tsx    # Bottom sheet emoji picker
│   │   ├── mobile-action-sheet.tsx    # Generic action menu
│   │   └── mobile-time-presets.tsx    # Preset time picker for mobile
│   ├── ui/
│   │   └── drawer.tsx                 # Vaul-based drawer (add via shadcn)
│   └── responsive/
│       └── responsive-dialog.tsx      # Desktop Dialog / Mobile Drawer
├── hooks/
│   ├── use-long-press.ts              # Long-press gesture detection
│   └── use-responsive-dialog.ts       # Dialog/Drawer switcher
└── lib/
    └── pwa/
        └── use-is-mobile.ts           # Already exists from Phase 19
```

### Pattern 1: Responsive Dialog/Drawer
**What:** Show Dialog on desktop, Drawer on mobile for the same content
**When to use:** Any modal/popup that should feel native on mobile
**Example:**
```tsx
// src/components/responsive/responsive-dialog.tsx
"use client";

import { useIsMobile } from "@/lib/pwa/use-is-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  children
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 2: Long-Press Hook
**What:** Detect long-press gestures on touch devices for context menus
**When to use:** Message actions, context menus, quick reactions
**Example:**
```tsx
// src/hooks/use-long-press.ts
"use client";

import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number; // Default 500ms
}

export function useLongPress({
  onLongPress,
  onClick,
  delay = 500
}: UseLongPressOptions) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isLongPress = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isLongPress.current = false;
    timeoutRef.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress();
      // Optional: vibration feedback on mobile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, delay);
  }, [onLongPress, delay]);

  const handleTouchEnd = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (!isLongPress.current && onClick) {
      onClick();
    }
  }, [onClick]);

  const handleTouchMove = useCallback(() => {
    // Cancel long-press if user moves finger
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
  };
}
```

### Pattern 3: Bottom Sheet with Snap Points
**What:** Drawer that snaps to half/full height (like iOS sheets)
**When to use:** Emoji picker, More menu, content that users might want to peek at
**Example:**
```tsx
// src/components/mobile/mobile-emoji-picker.tsx
"use client";

import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { EmojiPicker } from "@/components/emoji/emoji-picker";

interface MobileEmojiPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
}

export function MobileEmojiPicker({
  open,
  onOpenChange,
  onSelect
}: MobileEmojiPickerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[0.5, 1]} // Half screen, full screen
      fadeFromIndex={0}
    >
      <DrawerContent className="max-h-[85vh]">
        {/* No header - direct to picker for max space */}
        <div className="px-4 pb-safe">
          <EmojiPicker onSelect={onSelect} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

### Pattern 4: Preset Time Picker for Mobile
**What:** Quick presets (In 1 hour, Tomorrow 9am, etc.) with optional custom
**When to use:** Scheduled messages, reminders on mobile
**Example:**
```tsx
// src/components/mobile/mobile-time-presets.tsx
"use client";

import { addMinutes, addHours, addDays, setHours, setMinutes, format } from "date-fns";
import { Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Preset {
  label: string;
  getValue: () => Date;
}

const REMINDER_PRESETS: Preset[] = [
  { label: "In 20 min", getValue: () => addMinutes(new Date(), 20) },
  { label: "In 1 hour", getValue: () => addHours(new Date(), 1) },
  { label: "Tomorrow 9am", getValue: () => setMinutes(setHours(addDays(new Date(), 1), 9), 0) },
  { label: "Next week", getValue: () => addDays(new Date(), 7) },
];

interface MobileTimePresetsProps {
  onSelect: (date: Date) => void;
  presets?: Preset[];
}

export function MobileTimePresets({
  onSelect,
  presets = REMINDER_PRESETS
}: MobileTimePresetsProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const handleCustom = () => {
    if (customValue) {
      onSelect(new Date(customValue));
      setShowCustom(false);
      setCustomValue("");
    }
  };

  return (
    <div className="space-y-2">
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => onSelect(preset.getValue())}
          className="w-full min-h-11 text-left px-4 py-3 rounded-md hover:bg-accent transition-colors flex items-center gap-3"
        >
          <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <span>{preset.label}</span>
        </button>
      ))}

      {showCustom ? (
        <div className="p-2 space-y-2">
          <input
            type="datetime-local"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            className="w-full min-h-11 border border-input rounded-md px-3 py-2 text-sm bg-background"
          />
          <Button onClick={handleCustom} className="w-full" disabled={!customValue}>
            Set reminder
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className="w-full min-h-11 text-left px-4 py-3 rounded-md hover:bg-accent transition-colors flex items-center gap-3"
        >
          <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <span>Custom time...</span>
        </button>
      )}
    </div>
  );
}
```

### Pattern 5: Overflow Menu (Kebab/Three-Dot)
**What:** Vertical three-dot menu for channel header actions on mobile
**When to use:** Compact header space, multiple secondary actions
**Example:**
```tsx
// Usage in channel header
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Pin, FileText, Users, Settings } from "lucide-react";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="min-h-11 min-w-11 p-2 md:hidden">
      <MoreVertical className="h-5 w-5" />
      <span className="sr-only">Channel actions</span>
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuItem className="min-h-11">
      <Pin className="h-4 w-4 mr-2" />
      Pinned messages
    </DropdownMenuItem>
    <DropdownMenuItem className="min-h-11">
      <FileText className="h-4 w-4 mr-2" />
      Channel notes
    </DropdownMenuItem>
    <DropdownMenuItem className="min-h-11">
      <Users className="h-4 w-4 mr-2" />
      View members
    </DropdownMenuItem>
    <DropdownMenuItem className="min-h-11">
      <Settings className="h-4 w-4 mr-2" />
      Settings
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Anti-Patterns to Avoid
- **Using native datetime-local everywhere:** On mobile, presets are faster and easier than pickers. Use presets + custom fallback.
- **Tap-outside to close on mobile:** Radix Dialog/Sheet supports this, but users expect explicit close buttons. Always show close button.
- **Swipe-down to dismiss without affordance:** While Vaul supports this, user needs visual cue (drag handle) that it's swipeable.
- **Small touch targets in lists:** Entire list item should be tappable (44px min height), not just icon.
- **Overflow menu on desktop:** Three-dot menu is mobile pattern. Desktop should show actions inline or in larger dropdown.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet with gestures | Custom drag implementation | Vaul | Handles edge cases: momentum scrolling, snap points, accessibility |
| Long-press detection | Manual touch event tracking | Custom hook with timeout + vibration | Needs touch move cancellation, consistent delay |
| Responsive Dialog/Drawer | Conditional rendering everywhere | Wrapper component + useIsMobile | DRY principle, consistent behavior |
| Touch target enforcement | Manual min-h-11 everywhere | Tailwind @apply or component variants | Easy to audit, consistent |
| iOS safe area padding | JS calculations | Tailwind pb-safe or env(safe-area-inset-bottom) | Already available from Phase 19 |
| Emoji picker mobile optimization | Custom emoji grid | @emoji-mart with perLine prop | Library handles virtualization, search |

**Key insight:** Mobile UI libraries have evolved significantly. Vaul provides production-ready bottom sheets that handle gestures, accessibility, and performance. Focus implementation on business logic, not reinventing drawer mechanics.

## Common Pitfalls

### Pitfall 1: Radix Dropdown Menu Too Small on Mobile
**What goes wrong:** Radix DropdownMenu items are styled for desktop (compact), too small for touch on mobile.
**Why it happens:** Radix primitives are unstyled, shadcn/ui defaults to desktop sizing.
**How to avoid:**
- Use `min-h-11` class on all DropdownMenuItem components for mobile
- Consider switching to Drawer (action sheet style) for complex menus on mobile
- Add responsive variants: `className="h-8 md:h-11"` for mixed usage
**Warning signs:** Users struggling to tap correct menu item, accidental selections.

### Pitfall 2: Long-Press Conflicting with Scroll
**What goes wrong:** User tries to scroll message list, accidentally triggers long-press context menu.
**Why it happens:** Long-press hook doesn't cancel on touch move.
**How to avoid:** Add `handleTouchMove` that clears timeout if finger moves more than ~10px from start position.
**Warning signs:** Context menu appearing when user is trying to scroll.

### Pitfall 3: Bottom Sheet Scrolling Issues
**What goes wrong:** Sheet content scrolls, page behind also scrolls (scroll chaining).
**Why it happens:** CSS `overscroll-behavior` not set on sheet content.
**How to avoid:**
- Vaul handles this by default
- For custom implementations, add `overscroll-behavior: contain` to scrollable container
**Warning signs:** Background page scrolls when reaching top/bottom of sheet.

### Pitfall 4: Emoji Picker Performance on Mobile
**What goes wrong:** Emoji picker lags when opening or scrolling on lower-end mobile devices.
**Why it happens:** Rendering 1000+ emoji at once, no virtualization.
**How to avoid:**
- emoji-mart already does virtualization, but ensure lazy loading: `lazy(() => import("@emoji-mart/react"))`
- Use `perLine={6}` on mobile (larger emoji, fewer columns = less to render)
- Consider Suspense boundary with loading state
**Warning signs:** Janky animations when opening picker, scroll lag.

### Pitfall 5: Missing Safe Area Padding on Bottom Sheets
**What goes wrong:** Sheet content cut off by iOS home indicator or Android gesture bar.
**Why it happens:** Forgot to add safe-area-inset-bottom to sheet content.
**How to avoid:**
- Use Tailwind `pb-safe` class or `pb-[env(safe-area-inset-bottom)]`
- Vaul DrawerContent should include safe area by default (verify)
- Test on actual device with home indicator
**Warning signs:** Bottom content hidden, buttons not tappable.

### Pitfall 6: Hydration Mismatch with useIsMobile
**What goes wrong:** React hydration error when using `useIsMobile` in ResponsiveDialog.
**Why it happens:** Server renders one thing (desktop), client detects mobile and renders different thing.
**How to avoid:**
- Already handled in existing `useIsMobile` hook (returns `false` for server snapshot)
- Accept brief layout adjustment on client rather than blocking render
- Alternatively: CSS-only responsive with `hidden md:block` when possible
**Warning signs:** Console hydration warnings, brief flash of wrong UI.

### Pitfall 7: Native datetime-local Input Styling Inconsistency
**What goes wrong:** Native datetime-local looks different across browsers, can't be fully styled.
**Why it happens:** Browser controls are part of shadow DOM, limited CSS access.
**How to avoid:**
- Use for custom fallback only (when user clicks "Custom time...")
- Don't rely on it matching app's design system
- Alternatively: use react-day-picker + time input separately for full control
**Warning signs:** Input looks out of place, different on iOS vs Android.

## Code Examples

Verified patterns from official sources and existing codebase:

### shadcn/ui Drawer Component (Add to Project)
```bash
# Add drawer component via shadcn CLI
npx shadcn@latest add drawer
```

This installs Vaul-based drawer component matching project's design system.

### Mobile Bottom Navigation with More Menu
```tsx
// src/components/mobile/mobile-tab-bar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, AtSign, Search, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

interface MobileTabBarProps {
  workspaceSlug: string;
}

const primaryTabs = [
  { href: (slug: string) => `/${slug}`, icon: Home, label: "Home" },
  { href: (slug: string) => `/${slug}/threads`, icon: AtSign, label: "Threads" },
  { href: (slug: string) => `/${slug}/search`, icon: Search, label: "Search" },
];

const moreTabs = [
  { href: (slug: string) => `/${slug}/scheduled`, label: "Scheduled messages" },
  { href: (slug: string) => `/${slug}/reminders`, label: "Reminders" },
  { href: (slug: string) => `/${slug}/saved`, label: "Bookmarks" },
  { href: (slug: string) => `/${slug}/settings`, label: "Settings" },
];

export function MobileTabBar({ workspaceSlug }: MobileTabBarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background
          pb-[env(safe-area-inset-bottom)]
          pl-[env(safe-area-inset-left)]
          pr-[env(safe-area-inset-right)]
          md:hidden"
      >
        <div className="flex h-16 items-center justify-around">
          {primaryTabs.map(({ href, icon: Icon, label }) => {
            const tabHref = href(workspaceSlug);
            const isActive = pathname === tabHref;

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

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2",
              "transition-colors hover:bg-accent text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-xs">More</span>
          </button>
        </div>
      </nav>

      {/* More menu drawer */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>More</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-safe space-y-1">
            {moreTabs.map(({ href, label }) => {
              const tabHref = href(workspaceSlug);
              const isActive = pathname === tabHref;

              return (
                <Link
                  key={label}
                  href={tabHref}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "block min-h-11 px-4 py-3 rounded-md hover:bg-accent transition-colors",
                    isActive && "bg-accent text-primary font-medium"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
```

### Long-Press Context Menu on Messages
```tsx
// In message-item.tsx
import { useLongPress } from "@/hooks/use-long-press";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useState } from "react";

export function MessageItem({ message }) {
  const [contextOpen, setContextOpen] = useState(false);
  const isMobile = useIsMobile();

  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (isMobile) {
        setContextOpen(true);
      }
    },
  });

  return (
    <>
      <div {...(isMobile ? longPressHandlers : {})}>
        {/* Message content */}
      </div>

      {/* Mobile context menu */}
      <Drawer open={contextOpen} onOpenChange={setContextOpen}>
        <DrawerContent>
          <div className="px-4 pb-safe space-y-1">
            <button className="w-full min-h-11 text-left px-4 py-3 rounded-md hover:bg-accent">
              Reply in thread
            </button>
            <button className="w-full min-h-11 text-left px-4 py-3 rounded-md hover:bg-accent">
              Bookmark
            </button>
            <button className="w-full min-h-11 text-left px-4 py-3 rounded-md hover:bg-accent">
              Set reminder
            </button>
            <button className="w-full min-h-11 text-left px-4 py-3 rounded-md hover:bg-accent text-destructive">
              Delete message
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
```

### Responsive Emoji Picker
```tsx
// Update emoji-picker.tsx to support mobile
"use client";

import { useIsMobile } from "@/lib/pwa/use-is-mobile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { EmojiPicker as EmojiPickerBase } from "@/components/emoji/emoji-picker";

interface EmojiPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPickerDialog({ open, onOpenChange, onSelect }: EmojiPickerDialogProps) {
  const isMobile = useIsMobile();

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onOpenChange(false);
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <div className="px-4 pb-safe">
            <EmojiPickerBase
              onSelect={handleSelect}
              // Mobile optimizations
              perLine={6}  // Fewer columns, larger targets
              previewPosition="none"  // Save space
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <EmojiPickerBase onSelect={handleSelect} />
      </DialogContent>
    </Dialog>
  );
}
```

### Touch Target Audit Utility Class
```css
/* Add to globals.css */
@layer utilities {
  /* Safe area padding shortcuts */
  .pb-safe {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }

  .pt-safe {
    padding-top: max(1rem, env(safe-area-inset-top));
  }

  /* Touch target enforcement (44px minimum) */
  .touch-target {
    @apply min-h-11 min-w-11;
  }
}

/* Audit helper - temporarily add to see which elements are too small */
/* Remove before production */
@media (max-width: 768px) {
  button:not(.touch-target),
  a:not(.touch-target),
  [role="button"]:not(.touch-target) {
    /* Uncomment to debug: outline: 2px solid red; */
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom bottom sheets | Vaul library | 2023-2024 | Native feel, better accessibility, snap points |
| Dialog for everything | Responsive Dialog/Drawer | 2024+ | Better mobile UX, native patterns |
| Right-click context menus | Long-press on mobile | Always | Touch devices don't have right-click |
| Hamburger menu only | Hybrid bottom tabs + More | 2024+ | Faster access to primary features |
| Native datetime pickers | Preset shortcuts + custom | 2024+ | Faster input, better mobile UX |
| Fixed 44pt touch targets | Dynamic 46-48px at edges | iOS HIG 2024 | Account for less precision at screen edges |

**Deprecated/outdated:**
- Custom swipe gesture libraries - Vaul handles this
- Hamburger-only navigation on mobile - Bottom tabs are now standard
- Small dropdown menus on mobile - Use action sheets (Drawer) instead
- Tap-outside-only to close modals - Mobile users expect close button

## Open Questions

Things that couldn't be fully resolved:

1. **Vaul safe area handling**
   - What we know: Vaul uses Radix Dialog primitive, should inherit safe area support
   - What's unclear: Whether DrawerContent automatically includes safe-area-inset-bottom or needs manual addition
   - Recommendation: Test on device, add `pb-safe` class to DrawerContent if needed

2. **Quick reactions on long-press vs emoji picker**
   - What we know: Context specifies "show 3-4 common reactions on long-press before full picker"
   - What's unclear: Whether this is inline popover or part of the action sheet
   - Recommendation: Show quick reactions (👍 ❤️ 😂 🎉) as inline buttons above long-press action sheet, with "More reactions..." option that opens full picker

3. **More menu primary vs secondary items**
   - What we know: Context gives Claude discretion on "exact primary nav items vs More contents"
   - What's unclear: Which features are most frequently used
   - Recommendation: Primary tabs: Home, Threads, Search. More menu: Scheduled, Reminders, Bookmarks, Settings, Profile. Can adjust based on usage analytics later.

4. **Date picker on mobile - react-day-picker vs native**
   - What we know: Project uses react-day-picker, works on mobile
   - What's unclear: Whether custom picker is better than presets for scheduled messages
   - Recommendation: Use presets for reminders (time-based), use Calendar for scheduled messages (specific date/time). Matches user mental models.

## Sources

### Primary (HIGH confidence)
- [Vaul GitHub Repository](https://github.com/emilkowalski/vaul) - Official Vaul documentation
- [shadcn/ui Drawer Documentation](https://ui.shadcn.com/docs/components/drawer) - Vaul integration guide
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) - Touch target sizing (44pt minimum)
- [WCAG 2.5.5: Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) - 44px AAA standard
- [Radix UI Context Menu](https://www.radix-ui.com/primitives/docs/components/context-menu) - Long-press support built-in
- [Radix UI Responsive Layout](https://www.radix-ui.com/themes/docs/overview/layout) - Responsive object syntax
- [emoji-mart npm](https://www.npmjs.com/package/emoji-mart) - Mobile optimization options

### Secondary (MEDIUM confidence)
- [Medium: Sliding Into Smooth UI with Vaul](https://medium.com/@subashnatrayan28/sliding-into-smooth-ui-my-journey-with-vaul-the-react-drawer-library-that-just-gets-you-e509ca68eff1) - Real-world Vaul usage (Jan 2026)
- [Mobile Navigation Design: 6 Patterns That Work in 2026](https://phone-simulator.com/blog/mobile-navigation-patterns-in-2026) - Bottom tabs + hamburger hybrid
- [UX Pickle: Hamburger vs. Kebab Menu](https://uxpickle.com/know-your-menu-hamburger-vs-kebab/) - Three-dot menu conventions
- [Smart Interface Design Patterns: Touch Target Sizes](https://smart-interface-design-patterns.com/articles/accessible-tap-target-sizes/) - Position-based sizing (46px at edges)
- [useHooks: useLongPress](https://usehooks.com/uselongpress) - Long-press hook pattern
- [Polypane 26: Safe Area and Small Viewport Units](https://polypane.app/blog/polypane-26-accurate-device-emulation-with-safe-area-and-small-viewport-units/) - Safe area verification (Sep 2025)

### Tertiary (LOW confidence - validate in implementation)
- [react-modal-sheet](https://github.com/Temzasse/react-modal-sheet) - Alternative to Vaul
- [MUI X Date Pickers Shortcuts](https://mui.com/x/react-date-pickers/shortcuts/) - Preset pattern reference
- WebSearch results on responsive dialog patterns - Multiple sources agree on pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vaul is industry standard, shadcn integration verified
- Architecture: HIGH - Patterns follow Radix UI primitives, existing codebase conventions
- Touch interactions: HIGH - iOS HIG and WCAG standards are authoritative
- Mobile patterns: MEDIUM - WebSearch-derived best practices, verified with multiple sources
- Specific implementation details: MEDIUM - Requires testing on devices

**Research date:** 2026-01-23
**Valid until:** 60 days (UI libraries evolve moderately fast, but patterns are stable)

# Phase 15: PWA Foundation - Research

**Researched:** 2026-01-18
**Domain:** Progressive Web App (Service Workers, Web App Manifest, Install Prompts)
**Confidence:** HIGH

## Summary

This research covers implementing PWA features in a Next.js 16 application using the App Router. The standard approach is to use **Serwist** (@serwist/next) for service worker management, which is a maintained fork of Workbox specifically adapted for Next.js. The user has decided to use Workbox-based patterns with stale-while-revalidate caching for the app shell.

Key findings:
- Serwist is the recommended library for Next.js PWA (successor to next-pwa, actively maintained)
- Next.js has native manifest.ts support via MetadataRoute.Manifest type
- workbox-window provides the API needed for service worker update notifications
- iOS requires manual "Add to Home Screen" flow detection via navigator.standalone
- The beforeinstallprompt event only works in Chromium-based browsers

**Primary recommendation:** Use @serwist/next for service worker generation with workbox-window for update notifications. Use Next.js native manifest.ts for the web app manifest. Implement custom install prompt UI with engagement tracking.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @serwist/next | latest | Service worker integration for Next.js | Maintained fork of next-pwa, works with App Router, Workbox-based |
| serwist | latest | Service worker runtime (peer dependency) | Workbox fork with modern API |
| workbox-window | 7.x | Service worker update detection/messaging | Official Google library for SW lifecycle management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A (built-in) | Next.js 16 | manifest.ts file convention | Always - use MetadataRoute.Manifest type |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @serwist/next | next-pwa | next-pwa is unmaintained (2+ years stale) |
| @serwist/next | Manual SW | Much more configuration, error-prone |
| workbox-window | Manual SW events | Lose event abstraction, more boilerplate |

**Installation:**
```bash
npm install @serwist/next workbox-window && npm install -D serwist
```

## Architecture Patterns

### Recommended Project Structure
```
src/app/
├── sw.ts                    # Service worker source (Serwist)
├── manifest.ts              # Web app manifest (Next.js native)
├── offline/
│   └── page.tsx            # Custom offline page
├── layout.tsx              # PWA metadata additions
└── components/
    └── pwa/
        ├── InstallPrompt.tsx      # Custom install banner
        ├── UpdateNotification.tsx  # SW update toast
        ├── OfflineBanner.tsx       # Offline status indicator
        └── IOSInstallGuide.tsx     # iOS-specific instructions
```

### Pattern 1: Service Worker with Serwist
**What:** Configure Serwist to generate service worker with precaching and offline fallback
**When to use:** Always for Next.js PWA
**Example:**
```typescript
// next.config.ts
// Source: https://serwist.pages.dev/docs/next/getting-started
import withSerwistInit from "@serwist/next";

const revision = process.env.VERCEL_GIT_COMMIT_SHA || crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist({
  output: "standalone",
});
```

```typescript
// src/app/sw.ts
// Source: https://serwist.pages.dev/docs/next/getting-started
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false, // User controls updates
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [{
      url: "/offline",
      matcher({ request }) {
        return request.destination === "document";
      },
    }],
  },
});

// Listen for skip waiting message from main thread
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();
```

### Pattern 2: Service Worker Update Notification
**What:** Detect waiting service worker and prompt user to reload
**When to use:** For user-controlled updates (per CONTEXT.md decision)
**Example:**
```typescript
// Source: https://developer.chrome.com/docs/workbox/handling-service-worker-updates
// Source: https://developer.chrome.com/docs/workbox/modules/workbox-window
import { Workbox } from "workbox-window";

let wb: Workbox | null = null;

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  wb = new Workbox("/sw.js");

  // Fires when new SW installed but waiting
  wb.addEventListener("waiting", (event) => {
    // Show update notification toast
    showUpdateNotification();
  });

  // Fires when new SW takes control
  wb.addEventListener("controlling", () => {
    // Reload to get new assets
    window.location.reload();
  });

  wb.register();
  return wb;
}

export function acceptUpdate() {
  if (wb) {
    wb.messageSkipWaiting();
  }
}
```

### Pattern 3: Custom Install Prompt (Chromium)
**What:** Capture beforeinstallprompt event, show custom UI after engagement
**When to use:** For custom install experience
**Example:**
```typescript
// Source: https://web.dev/learn/pwa/installation-prompt
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event
import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setIsInstallable(false);

    return outcome;
  }, [deferredPrompt]);

  return { isInstallable, isInstalled, promptInstall };
}
```

### Pattern 4: iOS Detection and Instructions
**What:** Detect iOS Safari and show manual Add to Home Screen instructions
**When to use:** iOS devices where beforeinstallprompt is unavailable
**Example:**
```typescript
// Source: https://brainhub.eu/library/pwa-on-ios
// Source: https://gist.github.com/IvoPereira/5a5106cdf9819af385fad55925f96190
export function useIOSInstallPrompt() {
  const [shouldShowIOSPrompt, setShouldShowIOSPrompt] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/.test(
      window.navigator.userAgent.toLowerCase()
    );

    // navigator.standalone is iOS-specific
    const isInStandaloneMode =
      "standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone;

    if (isIOS && !isInStandaloneMode) {
      setShouldShowIOSPrompt(true);
    }
  }, []);

  return { shouldShowIOSPrompt };
}
```

### Pattern 5: Next.js Native Manifest
**What:** Use Next.js MetadataRoute.Manifest type for type-safe manifest
**When to use:** Always - built into Next.js App Router
**Example:**
```typescript
// src/app/manifest.ts
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OComms",
    short_name: "OComms",
    description: "Secure team communication",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

### Anti-Patterns to Avoid
- **Using skipWaiting: true globally:** This auto-activates new SWs which can break pages mid-session. Use user-controlled updates instead.
- **Caching API responses in this phase:** Per CONTEXT.md, API caching is deferred to Phase 16 (IndexedDB).
- **Not disabling SW in development:** Stale caches cause confusing dev issues. Always `disable: process.env.NODE_ENV === "development"`.
- **Single icon size in manifest:** Provide 192x192, 512x512, and maskable versions for full compatibility.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker generation | Manual SW file | @serwist/next | Precache manifest generation, versioning, Next.js integration |
| SW update detection | navigator.serviceWorker events | workbox-window | Handles edge cases, provides clean event API |
| Precache strategy | Manual cache.addAll | Serwist precacheEntries | Automatic versioning, cleanup of stale entries |
| Runtime caching | Manual fetch handlers | Serwist runtimeCaching | Tested strategies, proper error handling |
| Manifest file | Static JSON | manifest.ts | Type safety, can be dynamic if needed |

**Key insight:** Service worker lifecycle management has many edge cases (multiple tabs, failed updates, partial installs). Libraries like workbox-window have solved these over years of iteration.

## Common Pitfalls

### Pitfall 1: Service Worker Scope Issues
**What goes wrong:** SW doesn't intercept requests outside its scope
**Why it happens:** SW scope defaults to its directory location
**How to avoid:** Place sw.js in public root, ensure start_url in manifest is within scope
**Warning signs:** Some pages work offline, others don't

### Pitfall 2: Stale Cache in Development
**What goes wrong:** Code changes don't appear after refresh
**Why it happens:** SW serves cached version
**How to avoid:** Disable SW in development: `disable: process.env.NODE_ENV === "development"`
**Warning signs:** Changes require hard refresh or DevTools cache clear

### Pitfall 3: iOS Storage Limitations
**What goes wrong:** PWA data disappears after 7 days of non-use
**Why it happens:** Safari's 7-day cap on script-writable storage (iOS 13.4+)
**How to avoid:** For critical data, sync to server. Accept limitation for cache.
**Warning signs:** Users report losing data on iOS

### Pitfall 4: beforeinstallprompt Not Firing
**What goes wrong:** Install prompt never appears on Android/Chrome
**Why it happens:** PWA criteria not met (HTTPS, valid manifest, SW, etc.)
**How to avoid:** Use Lighthouse PWA audit to verify criteria
**Warning signs:** Event listener attached but callback never runs

### Pitfall 5: Broken Navigation Preload
**What goes wrong:** First navigation after install is slow
**Why it happens:** Navigation preload not enabled or not supported
**How to avoid:** Set `navigationPreload: true` in Serwist config
**Warning signs:** Cold start noticeably slower than cached visits

### Pitfall 6: iOS Share Sheet Missing "Add to Home Screen"
**What goes wrong:** Users can't find install option
**Why it happens:** Option is buried in Share menu, varies by iOS version
**How to avoid:** Provide clear visual instructions with Safari share icon
**Warning signs:** iOS install rates near zero despite prompts

## Code Examples

Verified patterns from official sources:

### TypeScript Configuration for Service Worker
```json
// tsconfig.json additions
// Source: https://serwist.pages.dev/docs/next/getting-started
{
  "compilerOptions": {
    "types": ["@serwist/next/typings"],
    "lib": ["ES2020", "webworker", "dom"]
  },
  "exclude": ["public/sw.js"]
}
```

### Git Ignore for Generated SW Files
```gitignore
# Source: https://serwist.pages.dev/docs/next/getting-started
public/sw*
public/swe-worker*
```

### PWA Metadata in Layout
```typescript
// src/app/layout.tsx additions
// Source: https://serwist.pages.dev/docs/next/getting-started
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  applicationName: "OComms",
  title: "OComms",
  description: "Secure team communication",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OComms",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
```

### Offline Page with Auto-Reconnect
```typescript
// src/app/offline/page.tsx
"use client";
import { useEffect } from "react";

export default function OfflinePage() {
  useEffect(() => {
    const handleOnline = () => {
      window.location.reload();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">You're offline</h1>
        <p className="mt-2 text-muted-foreground">
          Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
```

### Required Icon Sizes
```
public/icons/
├── icon-192x192.png      # Required: Chrome/Android
├── icon-512x512.png      # Required: Chrome/Android splash
├── icon-maskable-512x512.png  # Android adaptive icons (80% safe zone)
├── apple-touch-icon.png  # iOS home screen (180x180)
└── favicon.ico           # Browser tab
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-pwa | @serwist/next | 2024 | next-pwa unmaintained, Serwist actively developed |
| Static manifest.json | manifest.ts | Next.js 13.3+ | Type safety, dynamic generation possible |
| Manual SW registration | workbox-window | Stable | Cleaner API, better event handling |
| navigator.standalone only | display-mode media query | Modern | Cross-platform standalone detection |

**Deprecated/outdated:**
- `next-pwa`: Last update 2+ years ago, doesn't support App Router well
- `next-offline`: Unmaintained
- `@ducanh2912/next-pwa`: Recommends migrating to @serwist/next

## Open Questions

Things that couldn't be fully resolved:

1. **Serwist version compatibility with Next.js 16**
   - What we know: Serwist docs show Next.js 14/15 examples
   - What's unclear: Any breaking changes in Next.js 16 webpack config
   - Recommendation: Test during implementation, check Serwist GitHub issues

2. **workbox-window integration with Serwist**
   - What we know: Both are Workbox-based, should be compatible
   - What's unclear: Whether Serwist provides its own window module
   - Recommendation: Can use workbox-window directly as it's browser-only

3. **Forced update mechanism for security patches**
   - What we know: CONTEXT.md mentions "flag mechanism" for forced updates
   - What's unclear: Best practice for implementing this
   - Recommendation: Could use SW message passing with version comparison

## Sources

### Primary (HIGH confidence)
- [Serwist Getting Started](https://serwist.pages.dev/docs/next/getting-started) - Full Next.js integration guide
- [Next.js Manifest Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest) - Native manifest.ts support
- [Chrome Workbox-Window Docs](https://developer.chrome.com/docs/workbox/modules/workbox-window) - Complete API reference
- [Chrome Service Worker Updates](https://developer.chrome.com/docs/workbox/handling-service-worker-updates) - Update notification pattern

### Secondary (MEDIUM confidence)
- [web.dev Installation Prompt](https://web.dev/learn/pwa/installation-prompt) - beforeinstallprompt implementation
- [MDN beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event) - Event specification
- [Brainhub iOS PWA 2025](https://brainhub.eu/library/pwa-on-ios) - iOS limitations overview

### Tertiary (LOW confidence)
- Various GitHub discussions on Serwist offline fallback patterns
- Medium/dev.to articles on Next.js PWA implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Serwist is clearly the current standard, documented and maintained
- Architecture: HIGH - Patterns verified against official documentation
- Pitfalls: MEDIUM - Some iOS-specific issues based on community reports

**Research date:** 2026-01-18
**Valid until:** 60 days (PWA APIs are stable, library versions may update)

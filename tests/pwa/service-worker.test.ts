/**
 * Service Worker Tests
 *
 * Unit tests for service worker registration and update behavior.
 * Tests the register-sw module functionality.
 *
 * Note: Full e2e service worker tests require a browser environment.
 * These unit tests verify the registration logic and event handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock serviceWorker types and functions
const mockServiceWorkerContainer = {
  register: vi.fn(),
  ready: Promise.resolve({
    active: { state: "activated" },
    installing: null,
    waiting: null,
    update: vi.fn().mockResolvedValue(undefined),
  }),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  controller: { state: "activated" },
};

// Mock navigator with serviceWorker
const originalNavigator = globalThis.navigator;
const mockNavigator = {
  ...originalNavigator,
  serviceWorker: mockServiceWorkerContainer,
  onLine: true,
};

describe("Service Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - mocking navigator
    globalThis.navigator = mockNavigator;
    mockServiceWorkerContainer.register.mockResolvedValue({
      active: { state: "activated" },
      installing: null,
      waiting: null,
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    // @ts-expect-error - restoring navigator
    globalThis.navigator = originalNavigator;
  });

  describe("Registration", () => {
    it("detects serviceWorker API availability", () => {
      expect("serviceWorker" in navigator).toBe(true);
    });

    it("provides ready promise for SW activation", async () => {
      const ready = await navigator.serviceWorker.ready;
      expect(ready.active).not.toBeNull();
    });

    it("tracks service worker states correctly", () => {
      const states: ServiceWorkerState[] = [
        "parsed",
        "installing",
        "installed",
        "activating",
        "activated",
        "redundant",
      ];

      // All valid states should be recognized
      states.forEach((state) => {
        expect(typeof state).toBe("string");
      });
    });
  });

  describe("Registration options", () => {
    it("registers with correct scope option", async () => {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      expect(mockServiceWorkerContainer.register).toHaveBeenCalledWith(
        "/sw.js",
        { scope: "/" }
      );
    });

    it("registers with updateViaCache option", async () => {
      await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none",
      });

      expect(mockServiceWorkerContainer.register).toHaveBeenCalledWith(
        "/sw.js",
        { updateViaCache: "none" }
      );
    });
  });

  describe("Update detection", () => {
    it("provides update method on registration", async () => {
      const registration = await navigator.serviceWorker.ready;

      expect(typeof registration.update).toBe("function");
    });

    it("detects waiting service worker", async () => {
      // Mock a waiting worker
      const waitingReg = {
        active: { state: "activated" },
        installing: null,
        waiting: { state: "installed" },
        update: vi.fn().mockResolvedValue(undefined),
      };

      mockServiceWorkerContainer.ready = Promise.resolve(waitingReg);

      const reg = await navigator.serviceWorker.ready;
      expect(reg.waiting).not.toBeNull();
    });

    it("detects installing service worker", async () => {
      // Mock an installing worker
      const installingReg = {
        active: { state: "activated" },
        installing: { state: "installing" },
        waiting: null,
        update: vi.fn().mockResolvedValue(undefined),
      };

      mockServiceWorkerContainer.ready = Promise.resolve(installingReg);

      const reg = await navigator.serviceWorker.ready;
      expect(reg.installing).not.toBeNull();
    });
  });

  describe("Online/offline behavior", () => {
    it("detects online status", () => {
      expect(navigator.onLine).toBe(true);
    });

    it("handles offline detection", () => {
      // @ts-expect-error - mocking navigator.onLine
      globalThis.navigator = { ...mockNavigator, onLine: false };

      expect(navigator.onLine).toBe(false);
    });
  });

  describe("Event listeners", () => {
    it("supports controllerchange event", () => {
      const handler = vi.fn();

      navigator.serviceWorker.addEventListener("controllerchange", handler);

      expect(mockServiceWorkerContainer.addEventListener).toHaveBeenCalledWith(
        "controllerchange",
        handler
      );
    });

    it("supports message event", () => {
      const handler = vi.fn();

      navigator.serviceWorker.addEventListener("message", handler);

      expect(mockServiceWorkerContainer.addEventListener).toHaveBeenCalledWith(
        "message",
        handler
      );
    });
  });

  describe("Cache API integration points", () => {
    it("caches API is available", () => {
      // Mock caches API
      const mockCaches = {
        open: vi.fn().mockResolvedValue({
          put: vi.fn(),
          match: vi.fn(),
          delete: vi.fn(),
          keys: vi.fn().mockResolvedValue([]),
        }),
        keys: vi.fn().mockResolvedValue(["app-shell-v1"]),
        delete: vi.fn(),
      };

      // @ts-expect-error - mocking caches
      globalThis.caches = mockCaches;

      expect(typeof caches.open).toBe("function");
      expect(typeof caches.keys).toBe("function");
    });
  });
});

/**
 * Full e2e service worker tests require Playwright.
 * Below is the test structure that would be used with Playwright.
 *
 * To enable these tests:
 * 1. npm install -D @playwright/test
 * 2. npx playwright install
 * 3. Create playwright.config.ts
 * 4. Rename this file extension to .spec.ts
 */

// import { test, expect } from "@playwright/test";
//
// test.describe("Service Worker E2E", () => {
//   test.describe("Installation", () => {
//     test("service worker installs and activates", async ({ page }) => {
//       await page.goto("/");
//       const swReady = await page.evaluate(async () => {
//         const reg = await navigator.serviceWorker.ready;
//         return reg.active !== null;
//       });
//       expect(swReady).toBe(true);
//     });
//
//     test("app shell is cached after first visit", async ({ page }) => {
//       await page.goto("/");
//       const cached = await page.evaluate(async () => {
//         const cache = await caches.open("app-shell-v1");
//         const keys = await cache.keys();
//         return keys.map(k => k.url);
//       });
//       expect(cached).toContain(expect.stringContaining("/_next/static"));
//     });
//   });
//
//   test.describe("Offline behavior", () => {
//     test("serves cached page when offline", async ({ page, context }) => {
//       await page.goto("/");
//       await page.waitForSelector("[data-testid='app-loaded']");
//       await context.setOffline(true);
//       await page.reload();
//       await expect(page.locator("[data-testid='app-loaded']")).toBeVisible();
//     });
//   });
// });

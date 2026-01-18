"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// BeforeInstallPromptEvent is not in standard TypeScript lib
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const STORAGE_KEY = "pwa-install-dismissed";
const ENGAGEMENT_KEY = "pwa-engagement";

interface EngagementData {
  pageViews: number;
  firstVisit: number;
}

function getEngagement(): EngagementData {
  if (typeof window === "undefined") {
    return { pageViews: 0, firstVisit: Date.now() };
  }
  try {
    const stored = localStorage.getItem(ENGAGEMENT_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { pageViews: 0, firstVisit: Date.now() };
}

function saveEngagement(data: EngagementData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

// Check if engagement threshold met (3 pages OR 30 seconds)
function checkEngagementThreshold(): boolean {
  const engagement = getEngagement();
  const now = Date.now();
  const timeSpent = now - engagement.firstVisit;
  return engagement.pageViews >= 3 || timeSpent >= 30 * 1000;
}

// Subscribe to standalone mode changes
function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

// Helper to increment engagement on first call
function incrementEngagementOnce(): boolean {
  if (typeof window === "undefined") return checkEngagementThreshold();

  // Use a flag in sessionStorage to prevent double-increment in strict mode
  const incrementedKey = "pwa-engagement-incremented";
  if (sessionStorage.getItem(incrementedKey)) {
    return checkEngagementThreshold();
  }
  sessionStorage.setItem(incrementedKey, "true");

  const engagement = getEngagement();
  engagement.pageViews += 1;
  saveEngagement(engagement);

  return checkEngagementThreshold();
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  // Initialize engagement state by incrementing page views during init
  const [meetsEngagement, setMeetsEngagement] = useState(incrementEngagementOnce);
  const [dismissedState, setDismissedState] = useState(isDismissed);

  // Use useSyncExternalStore for standalone detection
  const isInstalled = useSyncExternalStore(
    subscribeStandalone,
    getIsStandalone,
    () => false // server snapshot
  );

  // Check engagement threshold after 30 seconds if not already met
  useEffect(() => {
    if (typeof window === "undefined" || meetsEngagement) return;

    const timer = setTimeout(() => {
      if (checkEngagementThreshold()) {
        setMeetsEngagement(true);
      }
    }, 30 * 1000);
    return () => clearTimeout(timer);
  }, [meetsEngagement]);

  // Listen for beforeinstallprompt
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInstalled || dismissedState) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isInstalled, dismissedState]);

  // Derived state: isInstallable
  const isInstallable = deferredPrompt !== null && meetsEngagement && !dismissedState && !isInstalled;

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      // isInstalled will update via useSyncExternalStore
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissedState(true);
    setDeferredPrompt(null);
  }, []);

  return {
    isInstallable,
    isInstalled,
    promptInstall,
    dismiss,
  };
}

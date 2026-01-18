"use client";

import { useCallback, useEffect, useState } from "react";

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

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [meetsEngagement, setMeetsEngagement] = useState(false);

  // Check engagement threshold: 3 pages OR 30 seconds
  useEffect(() => {
    if (typeof window === "undefined") return;

    const engagement = getEngagement();

    // Increment page views
    engagement.pageViews += 1;
    saveEngagement(engagement);

    // Check if already meets threshold
    const checkThreshold = () => {
      const now = Date.now();
      const timeSpent = now - engagement.firstVisit;
      const meetsCriteria =
        engagement.pageViews >= 3 || timeSpent >= 30 * 1000;
      if (meetsCriteria) {
        setMeetsEngagement(true);
      }
    };

    checkThreshold();

    // Also check after 30 seconds if not already met
    const timer = setTimeout(checkThreshold, 30 * 1000);
    return () => clearTimeout(timer);
  }, []);

  // Listen for beforeinstallprompt
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already in standalone mode
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    // Check if user previously dismissed
    if (isDismissed()) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
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
  }, []);

  // Update isInstallable when we have prompt AND meet engagement
  useEffect(() => {
    setIsInstallable(deferredPrompt !== null && meetsEngagement && !isDismissed());
  }, [deferredPrompt, meetsEngagement]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, "true");
    setIsInstallable(false);
    setDeferredPrompt(null);
  }, []);

  return {
    isInstallable,
    isInstalled,
    promptInstall,
    dismiss,
  };
}

"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "pwa-ios-dismissed";

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function getIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true
  );
}

function getIsDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

// Subscribe to standalone mode changes (iOS uses navigator.standalone)
function subscribeStandalone(callback: () => void) {
  // iOS standalone doesn't change at runtime, but we subscribe for consistency
  if (typeof window === "undefined") return () => {};
  // No event for navigator.standalone, so just return no-op cleanup
  return () => {};
}

// Compute if we should show iOS prompt
function computeShouldShow(): boolean {
  return isIOS() && !getIsStandalone() && !getIsDismissed();
}

export function useIOSInstall() {
  // Use useSyncExternalStore for standalone state
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getIsStandalone,
    () => false
  );

  const [dismissed, setDismissed] = useState(getIsDismissed);

  // Derived state - only show if iOS, not standalone, and not dismissed
  const shouldShowIOSPrompt = isIOS() && !isStandalone && !dismissed;

  const dismissIOSPrompt = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }, []);

  return {
    shouldShowIOSPrompt,
    dismissIOSPrompt,
  };
}

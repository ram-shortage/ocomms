"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pwa-ios-dismissed";

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true
  );
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function useIOSInstall() {
  const [shouldShowIOSPrompt, setShouldShowIOSPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Show prompt if: iOS + not already standalone + not dismissed
    const shouldShow = isIOS() && !isStandalone() && !isDismissed();
    setShouldShowIOSPrompt(shouldShow);
  }, []);

  const dismissIOSPrompt = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, "true");
    setShouldShowIOSPrompt(false);
  }, []);

  return {
    shouldShowIOSPrompt,
    dismissIOSPrompt,
  };
}

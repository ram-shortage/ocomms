"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768; // md breakpoint in Tailwind

function getIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function subscribeIsMobile(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mediaQuery.addEventListener("change", callback);

  return () => mediaQuery.removeEventListener("change", callback);
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribeIsMobile,
    getIsMobile,
    () => false // Server snapshot - assume desktop for SSR (CSS handles initial mobile render)
  );
}

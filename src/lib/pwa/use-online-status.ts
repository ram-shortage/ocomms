"use client";

import { useSyncExternalStore } from "react";

function getOnlineStatus(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

function subscribeOnlineStatus(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnlineStatus() {
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatus,
    () => true // server snapshot - assume online
  );

  return { isOnline };
}

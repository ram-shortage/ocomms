import { Workbox } from "workbox-window";

let wb: Workbox | null = null;
let updateCallback: (() => void) | null = null;

export function registerServiceWorker(onUpdate?: () => void) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  // Don't register in development
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  updateCallback = onUpdate || null;
  wb = new Workbox("/sw.js");

  // Fires when new SW installed but waiting
  wb.addEventListener("waiting", () => {
    if (updateCallback) {
      updateCallback();
    }
  });

  // Fires when new SW takes control
  wb.addEventListener("controlling", () => {
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

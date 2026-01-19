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
  skipWaiting: false, // User controls updates (per CONTEXT.md)
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Listen for skip waiting message from main thread
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();

// Push notification handler
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) {
    console.log("[SW] Push received but no data");
    return;
  }

  try {
    const data = event.data.json() as {
      title: string;
      body: string;
      icon?: string;
      data?: { url?: string; tag?: string };
    };
    const { title, body, icon, data: notificationData } = data;

    const options: NotificationOptions & { renotify?: boolean } = {
      body,
      icon: icon || "/icons/icon-192x192.png",
      badge: "/icons/badge-96x96.png",
      data: notificationData,
      tag: notificationData?.tag,
      renotify: true,
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error("[SW] Error handling push:", error);
  }
});

// Notification click handler - opens specific conversation/channel
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const url = (event.notification.data?.url as string | undefined) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients: readonly WindowClient[]) => {
        // Check if URL already open in a tab
        for (const client of windowClients) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        // Open new window if no matching tab
        return self.clients.openWindow(url);
      })
  );
});

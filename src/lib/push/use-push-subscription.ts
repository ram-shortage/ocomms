"use client";

import { useState, useEffect, useCallback } from "react";

type PushPermissionState = "prompt" | "granted" | "denied" | "unsupported";

interface UsePushSubscriptionReturn {
  /** Current permission state */
  permissionState: PushPermissionState;
  /** Whether user is currently subscribed */
  isSubscribed: boolean;
  /** Whether a subscription operation is in progress */
  isLoading: boolean;
  /** Request permission and subscribe */
  subscribe: () => Promise<boolean>;
  /** Unsubscribe from push */
  unsubscribe: () => Promise<boolean>;
  /** Whether push is supported on this device */
  isSupported: boolean;
  /** Whether this is iOS (requires PWA installation) */
  isIOS: boolean;
  /** Whether running as installed PWA */
  isStandalone: boolean;
}

/**
 * Convert VAPID public key from URL-safe base64 to Uint8Array.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [permissionState, setPermissionState] =
    useState<PushPermissionState>("prompt");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Detect environment
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const isIOS =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone ===
          true));

  // Check current state on mount
  useEffect(() => {
    if (!isSupported) {
      setPermissionState("unsupported");
      return;
    }

    // Check notification permission
    const permission = Notification.permission;
    if (permission === "denied") {
      setPermissionState("denied");
      return;
    }
    if (permission === "granted") {
      setPermissionState("granted");
    }

    // Check if already subscribed
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
        });
      })
      .catch(() => {
        // Service worker not ready yet
      });
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.error("[Push] Not supported on this device");
      return false;
    }

    setIsLoading(true);
    try {
      // Request notification permission
      console.log("[Push] Requesting notification permission...");
      const permission = await Notification.requestPermission();
      setPermissionState(permission as PushPermissionState);

      if (permission !== "granted") {
        console.log("[Push] Permission not granted:", permission);
        return false;
      }
      console.log("[Push] Permission granted");

      // Get VAPID public key from server
      console.log("[Push] Fetching VAPID public key...");
      const vapidResponse = await fetch("/api/push/vapid-public");
      if (!vapidResponse.ok) {
        const errorText = await vapidResponse.text();
        console.error("[Push] Failed to get VAPID key:", vapidResponse.status, errorText);
        return false;
      }
      const { publicKey, error: vapidError } = await vapidResponse.json();
      if (vapidError || !publicKey) {
        console.error("[Push] VAPID key response error:", vapidError);
        return false;
      }
      console.log("[Push] Got VAPID key, length:", publicKey.length);

      // Get service worker registration
      console.log("[Push] Getting service worker registration...");
      const registration = await navigator.serviceWorker.ready;
      console.log("[Push] Service worker ready");

      // Subscribe to push
      console.log("[Push] Subscribing to push manager...");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      console.log("[Push] Push subscription created");

      // Send subscription to server
      console.log("[Push] Sending subscription to server...");
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Push] Failed to save subscription:", response.status, errorText);
        // Unsubscribe if server storage failed
        await subscription.unsubscribe();
        return false;
      }

      console.log("[Push] Subscription saved successfully");
      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error("[Push] Subscribe error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return true;
      }

      // Remove from server first
      await fetch("/api/push/unsubscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      // Then unsubscribe locally
      await subscription.unsubscribe();

      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error("[Push] Unsubscribe error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return {
    permissionState,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    isSupported,
    isIOS,
    isStandalone,
  };
}

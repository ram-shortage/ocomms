"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket-client";
import { initSyncOnReconnect, cleanupSyncListeners } from "@/lib/cache";

/**
 * Initializes sync-on-reconnect event listeners for the send queue.
 * Should be mounted near the root of the app to enable automatic
 * queue processing when going online, tab becomes visible, or socket reconnects.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const socket = getSocket();
    initSyncOnReconnect(socket);

    return () => {
      cleanupSyncListeners();
    };
  }, []);

  return <>{children}</>;
}

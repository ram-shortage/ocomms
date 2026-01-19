"use client";

import { useEffect, useState } from "react";
import { registerServiceWorker, acceptUpdate } from "@/lib/pwa/register-sw";
import { initializeCache } from "@/lib/cache";
import { InstallPrompt } from "./InstallPrompt";
import { IOSInstallGuide } from "./IOSInstallGuide";
import { UpdateNotification } from "./UpdateNotification";
import { OfflineBanner } from "./OfflineBanner";

export function PWAProvider() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // Register service worker with update callback
    registerServiceWorker(() => {
      setHasUpdate(true);
    });

    // Initialize message cache (runs cleanup on 7-day-old messages)
    initializeCache();
  }, []);

  const handleRefresh = () => {
    acceptUpdate();
    // The 'controlling' event in register-sw.ts will trigger reload
  };

  return (
    <>
      <OfflineBanner />
      <InstallPrompt />
      <IOSInstallGuide />
      <UpdateNotification hasUpdate={hasUpdate} onRefresh={handleRefresh} />
    </>
  );
}

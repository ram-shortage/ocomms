"use client";

import { useEffect, useState } from "react";
import { registerServiceWorker, acceptUpdate } from "@/lib/pwa/register-sw";
import { initializeCache } from "@/lib/cache";
import { InstallPrompt } from "./InstallPrompt";
import { IOSInstallGuide } from "./IOSInstallGuide";
import { UpdateNotification } from "./UpdateNotification";
import { OfflineBanner } from "./OfflineBanner";
import { PushPermissionPrompt } from "@/components/push";

const PUSH_PROMPT_DISMISSED_KEY = "push-prompt-dismissed";
const ENGAGEMENT_KEY = "pwa-engagement";

// Check engagement threshold (same logic as useInstallPrompt - 3 pages OR 30 seconds)
function checkEngagementThreshold(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(ENGAGEMENT_KEY);
    if (!stored) return false;
    const engagement = JSON.parse(stored);
    const now = Date.now();
    const timeSpent = now - engagement.firstVisit;
    return engagement.pageViews >= 3 || timeSpent >= 30 * 1000;
  } catch {
    return false;
  }
}

export function PWAProvider() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [pushPromptDismissed, setPushPromptDismissed] = useState(true); // Start hidden
  const [hasEngaged, setHasEngaged] = useState(false);

  useEffect(() => {
    // Register service worker with update callback
    registerServiceWorker(() => {
      setHasUpdate(true);
    });

    // Initialize message cache (runs cleanup on 7-day-old messages)
    initializeCache();
  }, []);

  useEffect(() => {
    // Load push prompt dismissal state from localStorage
    const dismissed = localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY);
    if (dismissed) {
      setPushPromptDismissed(true);
    } else {
      setPushPromptDismissed(false);
    }

    // Check engagement threshold
    if (checkEngagementThreshold()) {
      setHasEngaged(true);
    } else {
      // Check again after 30 seconds if not already met
      const timer = setTimeout(() => {
        if (checkEngagementThreshold()) {
          setHasEngaged(true);
        }
      }, 30 * 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleRefresh = () => {
    acceptUpdate();
    // The 'controlling' event in register-sw.ts will trigger reload
  };

  const handlePushDismiss = () => {
    setPushPromptDismissed(true);
    localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "true");
  };

  return (
    <>
      <OfflineBanner />
      <InstallPrompt />
      <IOSInstallGuide />
      <UpdateNotification hasUpdate={hasUpdate} onRefresh={handleRefresh} />
      {/* Show push prompt after engagement threshold met, if not dismissed */}
      {hasEngaged && !pushPromptDismissed && (
        <div className="fixed bottom-20 right-4 z-50 max-w-sm">
          <PushPermissionPrompt
            onDismiss={handlePushDismiss}
            onSubscribed={handlePushDismiss}
          />
        </div>
      )}
    </>
  );
}

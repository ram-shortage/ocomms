"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bell, X, AlertCircle } from "lucide-react";
import { usePushSubscription } from "@/lib/push/use-push-subscription";

interface PushPermissionPromptProps {
  /** Called when user dismisses the prompt */
  onDismiss?: () => void;
  /** Called after successful subscription */
  onSubscribed?: () => void;
}

export function PushPermissionPrompt({
  onDismiss,
  onSubscribed,
}: PushPermissionPromptProps) {
  const {
    permissionState,
    isSubscribed,
    isLoading,
    subscribe,
    isSupported,
    isIOS,
    isStandalone,
  } = usePushSubscription();

  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't show if already subscribed, dismissed, or not supported
  if (dismissed || isSubscribed || !isSupported) {
    return null;
  }

  // iOS requires PWA installation first
  if (isIOS && !isStandalone) {
    return null; // IOSInstallGuide handles this case
  }

  // Don't show if permission already denied
  if (permissionState === "denied") {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleEnable = async () => {
    setError(null);
    const success = await subscribe();
    if (success) {
      onSubscribed?.();
    } else {
      // Permission was granted but subscription registration failed
      // Check if permission state changed to granted
      if (Notification.permission === "granted") {
        setError("Subscription failed. You can retry in Settings.");
        // Auto-dismiss after showing error briefly
        setTimeout(() => {
          onSubscribed?.();
        }, 2000);
      } else if (Notification.permission === "denied") {
        // User denied permission - dismiss the popup
        handleDismiss();
      }
      // If still "default", user closed the dialog without deciding - keep popup visible
    }
  };

  return (
    <Card className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Enable Notifications?</CardTitle>
        </div>
        <CardDescription>
          Get notified when you receive a direct message or someone mentions
          you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {error && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={handleEnable} disabled={isLoading}>
            {isLoading ? "Enabling..." : "Enable Notifications"}
          </Button>
          <Button variant="ghost" onClick={handleDismiss}>
            Not Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

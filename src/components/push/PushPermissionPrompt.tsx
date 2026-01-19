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
import { Bell, X } from "lucide-react";
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
    const success = await subscribe();
    if (success) {
      onSubscribed?.();
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
      <CardContent className="flex gap-2">
        <Button onClick={handleEnable} disabled={isLoading}>
          {isLoading ? "Enabling..." : "Enable Notifications"}
        </Button>
        <Button variant="ghost" onClick={handleDismiss}>
          Not Now
        </Button>
      </CardContent>
    </Card>
  );
}

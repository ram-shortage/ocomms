"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bell, BellOff, AlertTriangle, Smartphone } from "lucide-react";
import { usePushSubscription } from "@/lib/push/use-push-subscription";

interface PushSettingsPanelProps {
  /** Show compact version */
  compact?: boolean;
}

export function PushSettingsPanel({ compact = false }: PushSettingsPanelProps) {
  const {
    permissionState,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    isSupported,
    isIOS,
    isStandalone,
  } = usePushSubscription();

  // Not supported at all
  if (!isSupported) {
    return (
      <Card>
        <CardHeader className={compact ? "pb-2" : undefined}>
          <div className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            <CardTitle className={compact ? "text-base" : "text-lg"}>
              Push Notifications
            </CardTitle>
          </div>
          <CardDescription>
            Push notifications are not supported in this browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // iOS but not installed as PWA
  if (isIOS && !isStandalone) {
    return (
      <Card>
        <CardHeader className={compact ? "pb-2" : undefined}>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <CardTitle className={compact ? "text-base" : "text-lg"}>
              Push Notifications
            </CardTitle>
          </div>
          <CardDescription>
            To receive push notifications on iOS, first add this app to your
            Home Screen.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Permission denied
  if (permissionState === "denied") {
    return (
      <Card>
        <CardHeader className={compact ? "pb-2" : undefined}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className={compact ? "text-base" : "text-lg"}>
              Push Notifications Blocked
            </CardTitle>
          </div>
          <CardDescription>
            Notifications are blocked. To enable them, click the lock icon in
            your browser&apos;s address bar and allow notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <Card>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <div className="flex items-center gap-2">
          {isSubscribed ? (
            <Bell className="h-5 w-5 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          <CardTitle className={compact ? "text-base" : "text-lg"}>
            Push Notifications
          </CardTitle>
        </div>
        <CardDescription>
          {isSubscribed
            ? "You will receive notifications for DMs and mentions."
            : "Enable to receive notifications for DMs and mentions."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant={isSubscribed ? "outline" : "default"}
          onClick={handleToggle}
          disabled={isLoading}
        >
          {isLoading
            ? "..."
            : isSubscribed
              ? "Disable Notifications"
              : "Enable Notifications"}
        </Button>
      </CardContent>
    </Card>
  );
}

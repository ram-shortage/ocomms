"use client";

import { useState } from "react";
import { Bell, BellOff, AtSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { NotificationMode } from "@/db/schema/channel-notification-settings";

interface NotificationSettingsDialogProps {
  channelId: string;
  channelName: string;
  currentMode: NotificationMode;
  onModeChange: (mode: NotificationMode) => void;
}

export function NotificationSettingsDialog({
  channelId,
  channelName,
  currentMode,
  onModeChange,
}: NotificationSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<NotificationMode>(currentMode);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (selectedMode === currentMode) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/channels/${channelId}/notifications`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update settings");
      }

      onModeChange(selectedMode);
      setOpen(false);

      const modeLabels = {
        all: "All activity",
        mentions: "Mentions only",
        muted: "Muted",
      };
      toast.success(`Notification setting changed to "${modeLabels[selectedMode]}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Reset to current mode when opening
      setSelectedMode(currentMode);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Notification settings">
          {currentMode === "muted" ? (
            <BellOff className="h-4 w-4" />
          ) : currentMode === "mentions" ? (
            <div className="relative">
              <Bell className="h-4 w-4" />
              <AtSign className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 bg-background rounded-full" />
            </div>
          ) : (
            <Bell className="h-4 w-4" />
          )}
          <span className="sr-only">Notification settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Choose how you want to be notified about activity in #{channelName}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedMode}
          onValueChange={(value) => setSelectedMode(value as NotificationMode)}
          className="gap-4"
        >
          <div className="flex items-start space-x-3 rounded-lg border p-4">
            <RadioGroupItem value="all" id="all" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="all" className="font-medium cursor-pointer">
                All activity
              </Label>
              <p className="text-sm text-muted-foreground">
                Get notified for all messages in this channel
              </p>
            </div>
            <Bell className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="flex items-start space-x-3 rounded-lg border p-4">
            <RadioGroupItem value="mentions" id="mentions" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="mentions" className="font-medium cursor-pointer">
                Mentions only
              </Label>
              <p className="text-sm text-muted-foreground">
                Only get notified when you&apos;re directly @mentioned
              </p>
            </div>
            <div className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <AtSign className="h-3 w-3 absolute -top-0.5 -right-0.5 bg-background rounded-full text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-lg border p-4">
            <RadioGroupItem value="muted" id="muted" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="muted" className="font-medium cursor-pointer">
                Muted
              </Label>
              <p className="text-sm text-muted-foreground">
                Don&apos;t receive any notifications from this channel
              </p>
            </div>
            <BellOff className="h-5 w-5 text-muted-foreground" />
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

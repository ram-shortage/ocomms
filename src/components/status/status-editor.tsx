"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setUserStatus, clearUserStatus } from "@/lib/actions/user-status";
import { STATUS_PRESETS } from "@/lib/constants/status-presets";
import { addHours, addDays } from "date-fns";

export interface UserStatusData {
  emoji: string | null;
  text: string | null;
  expiresAt: Date | null;
  dndEnabled: boolean;
}

interface StatusEditorProps {
  currentStatus?: UserStatusData | null;
  onClose?: () => void;
  onStatusSaved?: (status: UserStatusData) => void;
  onStatusCleared?: () => void;
}

const EXPIRATION_OPTIONS = [
  { label: "30 minutes", getValue: () => addHours(new Date(), 0.5) },
  { label: "1 hour", getValue: () => addHours(new Date(), 1) },
  { label: "4 hours", getValue: () => addHours(new Date(), 4) },
  { label: "Today", getValue: () => new Date(new Date().setHours(23, 59, 59, 999)) },
  { label: "This week", getValue: () => addDays(new Date(), 7) },
  { label: "Don't clear", getValue: () => null },
] as const;

export function StatusEditor({ currentStatus, onClose, onStatusSaved, onStatusCleared }: StatusEditorProps) {
  const [emoji, setEmoji] = useState(currentStatus?.emoji || "");
  const [text, setText] = useState(currentStatus?.text || "");
  const [selectedExpiration, setSelectedExpiration] = useState<string>("Don't clear");
  const [dndEnabled, setDndEnabled] = useState(currentStatus?.dndEnabled ?? false);
  const [isSaving, setIsSaving] = useState(false);

  const handlePreset = (preset: (typeof STATUS_PRESETS)[number]) => {
    setEmoji(preset.emoji);
    setText(preset.text);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const expirationOption = EXPIRATION_OPTIONS.find((opt) => opt.label === selectedExpiration);
      const expiresAt = expirationOption?.getValue() ?? null;

      await setUserStatus({
        emoji: emoji || undefined,
        text: text || undefined,
        expiresAt: expiresAt ?? undefined,
        dndEnabled,
      });

      // Notify parent of saved status for immediate UI update
      onStatusSaved?.({
        emoji: emoji || null,
        text: text || null,
        expiresAt,
        dndEnabled,
      });
      onClose?.();
    } catch (error) {
      console.error("Failed to set status:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await clearUserStatus();
      setEmoji("");
      setText("");
      setSelectedExpiration("Don't clear");
      setDndEnabled(false);
      // Notify parent that status was cleared
      onStatusCleared?.();
      onClose?.();
    } catch (error) {
      console.error("Failed to clear status:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasStatus = currentStatus?.text || currentStatus?.emoji;

  return (
    <div className="space-y-4 p-4 w-80">
      {/* Presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick presets</Label>
        <div className="flex flex-wrap gap-1">
          {STATUS_PRESETS.map((preset) => (
            <Button
              key={preset.key}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handlePreset(preset)}
            >
              {preset.emoji} {preset.text}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom status */}
      <div className="space-y-2">
        <Label htmlFor="status-text">Custom status</Label>
        <div className="flex gap-2">
          <Input
            id="status-emoji"
            value={emoji}
            onChange={(e) => {
              // Take last character(s) which could be an emoji
              const value = e.target.value;
              // Emoji can be up to 4 characters in JS due to surrogate pairs
              setEmoji(value.slice(-2));
            }}
            placeholder="..."
            className="w-12 text-center"
            maxLength={2}
          />
          <Input
            id="status-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 100))}
            placeholder="What's your status?"
            className="flex-1"
            maxLength={100}
          />
        </div>
        <p className="text-xs text-muted-foreground">{text.length}/100 characters</p>
      </div>

      {/* Expiration */}
      <div className="space-y-2">
        <Label>Clear status after</Label>
        <div className="flex flex-wrap gap-1">
          {EXPIRATION_OPTIONS.map((option) => (
            <Button
              key={option.label}
              variant={selectedExpiration === option.label ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedExpiration(option.label)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* DND toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="dnd">Pause notifications</Label>
          <p className="text-xs text-muted-foreground">Enable Do Not Disturb</p>
        </div>
        <Switch id="dnd" checked={dndEnabled} onCheckedChange={setDndEnabled} />
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={isSaving || !hasStatus}
        >
          Clear status
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

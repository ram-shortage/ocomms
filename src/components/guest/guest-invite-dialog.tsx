"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import { Check, Copy, Plus, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { createGuestInvite } from "@/lib/actions/guest";

interface Channel {
  id: string;
  name: string;
  slug: string;
}

interface GuestInviteDialogProps {
  organizationId: string;
  channels: Channel[];
  onInviteCreated?: () => void;
}

export function GuestInviteDialog({
  organizationId,
  channels,
  onInviteCreated,
}: GuestInviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const handleSelectAll = () => {
    if (selectedChannels.length === channels.length) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels(channels.map((ch) => ch.id));
    }
  };

  const handleGenerate = async () => {
    if (selectedChannels.length === 0) {
      setError("Please select at least one channel");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await createGuestInvite(
        organizationId,
        selectedChannels,
        expiresAt
      );
      const baseUrl = window.location.origin;
      setGeneratedLink(`${baseUrl}${result.inviteUrl}`);
      onInviteCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateAnother = () => {
    setGeneratedLink(null);
    setSelectedChannels([]);
    setExpiresAt(undefined);
    setError("");
    setCopied(false);
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state when closing
    setTimeout(() => {
      setGeneratedLink(null);
      setSelectedChannels([]);
      setExpiresAt(undefined);
      setError("");
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Invite Link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Guest Invite</DialogTitle>
          <DialogDescription>
            Generate a shareable link to invite a guest to specific channels
          </DialogDescription>
        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Invite link created!
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-white dark:bg-gray-900 rounded text-xs overflow-hidden overflow-ellipsis whitespace-nowrap">
                  {generatedLink}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Access granted to:</p>
              <div className="flex flex-wrap gap-1">
                {channels
                  .filter((ch) => selectedChannels.includes(ch.id))
                  .map((ch) => (
                    <span
                      key={ch.id}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted"
                    >
                      #{ch.name}
                    </span>
                  ))}
              </div>
              {expiresAt && (
                <p className="mt-2">
                  Guest access expires: {format(expiresAt, "PPP")}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCreateAnother}>
                Create Another
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Channel selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Channels</Label>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedChannels.length === channels.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {channels.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    No channels available
                  </p>
                ) : (
                  channels.map((channel) => (
                    <label
                      key={channel.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedChannels.includes(channel.id)}
                        onCheckedChange={() => handleChannelToggle(channel.id)}
                      />
                      <span className="text-sm">#{channel.name}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedChannels.length} channel{selectedChannels.length !== 1 ? "s" : ""}{" "}
                selected
              </p>
            </div>

            {/* Expiration date */}
            <div className="space-y-2">
              <Label>Guest Expiration (Optional)</Label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {expiresAt ? format(expiresAt, "PPP") : "No expiration"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={expiresAt}
                      onSelect={setExpiresAt}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                    <div className="p-2 border-t flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setExpiresAt(addDays(new Date(), 7))}
                      >
                        7 days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setExpiresAt(addDays(new Date(), 30))}
                      >
                        30 days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setExpiresAt(addDays(new Date(), 90))}
                      >
                        90 days
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                {expiresAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpiresAt(undefined)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {expiresAt
                  ? "Guest will be soft-locked after this date (can view but not post)"
                  : "Guest will have permanent access until manually removed"}
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={loading || selectedChannels.length === 0}
            >
              {loading ? "Generating..." : "Generate Invite Link"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

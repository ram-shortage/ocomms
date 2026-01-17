"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createChannel } from "@/lib/actions/channel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CreateChannelDialogProps {
  organizationId: string;
  workspaceSlug: string;
  trigger?: React.ReactNode;
}

export function CreateChannelDialog({
  organizationId,
  workspaceSlug,
  trigger,
}: CreateChannelDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (name.length < 2) {
      setError("Channel name must be at least 2 characters");
      return;
    }

    setLoading(true);

    try {
      const channel = await createChannel({
        organizationId,
        name,
        description: description || undefined,
        isPrivate,
      });

      setOpen(false);
      setName("");
      setDescription("");
      setIsPrivate(false);
      router.push(`/${workspaceSlug}/channels/${channel.slug}`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create channel");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            Create Channel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where conversations happen around a topic.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1">#</span>
              <Input
                id="channel-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. marketing"
                required
                minLength={2}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-description">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="channel-private"
              checked={isPrivate}
              onCheckedChange={(checked) => setIsPrivate(checked === true)}
              disabled
            />
            <Label
              htmlFor="channel-private"
              className="text-sm font-normal text-muted-foreground cursor-not-allowed"
            >
              Make private (coming soon)
            </Label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

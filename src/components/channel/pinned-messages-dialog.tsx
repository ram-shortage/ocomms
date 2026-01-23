"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pin, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PinnedMessage {
  id: string;
  messageId: string;
  pinnedAt: string;
  message: {
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string };
  };
  pinnedBy: { id: string; name: string };
}

interface PinnedMessagesDialogProps {
  channelId: string;
  currentUserId: string;
  /** Controlled open state (optional - for opening from external triggers like mobile menu) */
  open?: boolean;
  /** Callback when open state changes (required when using controlled mode) */
  onOpenChange?: (open: boolean) => void;
}

export function PinnedMessagesDialog({
  channelId,
  currentUserId,
  open: controlledOpen,
  onOpenChange,
}: PinnedMessagesDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;
  const [pins, setPins] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/pins`);
      if (res.ok) {
        const data = await res.json();
        setPins(data.pins);
      }
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    if (open) {
      fetchPins();
    }
  }, [open, fetchPins]);

  const handleUnpin = async (messageId: string) => {
    const res = await fetch(`/api/channels/${channelId}/pins?messageId=${messageId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPins((prev) => prev.filter((p) => p.messageId !== messageId));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only render trigger in uncontrolled mode */}
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Pin className="h-4 w-4 mr-1" />
            Pins
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Pinned Messages</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center">Loading...</p>
          ) : pins.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">No pinned messages</p>
          ) : (
            pins.map((pin) => (
              <div key={pin.id} className="border rounded-lg p-3 relative group">
                <button
                  onClick={() => handleUnpin(pin.messageId)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="font-medium">{pin.message.author.name}</span>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(pin.message.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm">{pin.message.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Pinned by {pin.pinnedBy.name}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

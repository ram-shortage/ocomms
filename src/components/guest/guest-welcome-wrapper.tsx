"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GuestWelcomeWrapperProps {
  organizationId: string;
  workspaceName: string;
  channels: string[];
  isGuest: boolean;
}

/**
 * Client wrapper for guest welcome modal
 * Checks localStorage for welcome flag and shows modal on first visit
 */
export function GuestWelcomeWrapper({
  organizationId,
  workspaceName,
  channels,
  isGuest,
}: GuestWelcomeWrapperProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isGuest) return;

    const key = `guest-welcome-${organizationId}`;
    const value = localStorage.getItem(key);

    if (value === "show") {
      setOpen(true);
    }
  }, [isGuest, organizationId]);

  const handleClose = () => {
    const key = `guest-welcome-${organizationId}`;
    localStorage.removeItem(key);
    setOpen(false);
  };

  if (!isGuest) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to {workspaceName}!</DialogTitle>
          <DialogDescription>
            You&apos;ve joined as a guest with limited access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium mb-2">You have access to:</p>
            <div className="flex flex-wrap gap-1">
              {channels.map((channel) => (
                <span
                  key={channel}
                  className="inline-flex items-center px-2 py-1 rounded text-sm bg-muted"
                >
                  # {channel}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">What you can do:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-green-600 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Send messages, react, and upload files in your channels
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-green-600 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Reply to direct messages from team members
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-green-600 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                View profiles of members in your channels
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Guest limitations:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cannot access other channels
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cannot start new direct messages
              </li>
              <li className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Access may expire (check with admin)
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            Got it!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

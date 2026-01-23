"use client";

import { useState } from "react";
import { Smile } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { StatusEditor, UserStatusData } from "@/components/status/status-editor";
import { StatusDisplay } from "@/components/status/status-display";

interface MobileStatusDrawerProps {
  currentStatus?: UserStatusData | null;
  onStatusSaved?: (status: UserStatusData) => void;
  onStatusCleared?: () => void;
}

/**
 * Mobile-friendly status editor presented in a bottom sheet drawer.
 * Provides touch-optimized access to status setting with 44px touch targets.
 */
export function MobileStatusDrawer({
  currentStatus,
  onStatusSaved,
  onStatusCleared,
}: MobileStatusDrawerProps) {
  const [open, setOpen] = useState(false);

  const handleSaved = (status: UserStatusData) => {
    onStatusSaved?.(status);
    setOpen(false);
  };

  const handleCleared = () => {
    onStatusCleared?.();
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button className="flex items-center gap-2 min-h-11 px-3 py-2 w-full text-left rounded-md hover:bg-accent active:bg-accent transition-colors">
          {currentStatus?.emoji ? (
            <StatusDisplay emoji={currentStatus.emoji} text={currentStatus.text} />
          ) : (
            <Smile className="h-5 w-5 text-muted-foreground" />
          )}
          <span className={currentStatus?.emoji || currentStatus?.text ? "" : "text-muted-foreground"}>
            {currentStatus?.text || "Set status"}
          </span>
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Set your status</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">
          <StatusEditor
            currentStatus={currentStatus}
            onClose={() => setOpen(false)}
            onStatusSaved={handleSaved}
            onStatusCleared={handleCleared}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

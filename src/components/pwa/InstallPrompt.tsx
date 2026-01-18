"use client";

import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function InstallPrompt() {
  const { isInstallable, isInstalled, promptInstall, dismiss } =
    useInstallPrompt();

  if (!isInstallable || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-out animate-in slide-in-from-bottom">
      <div className="bg-background border-t border-border p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">O</span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">Install OComms</p>
              <p className="text-xs text-muted-foreground truncate">
                Fast access from your home screen
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button onClick={promptInstall} size="sm">
              Install
            </Button>
            <Button
              onClick={dismiss}
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

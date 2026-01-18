"use client";

import { useIOSInstall } from "@/lib/pwa/use-ios-install";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Safari share icon as inline SVG
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function IOSInstallGuide() {
  const { shouldShowIOSPrompt, dismissIOSPrompt } = useIOSInstall();

  if (!shouldShowIOSPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-sm w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
        <Button
          onClick={dismissIOSPrompt}
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>

        <h2 className="text-lg font-semibold mb-4">Add to Home Screen</h2>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm">
                Tap the{" "}
                <span className="inline-flex items-center align-middle">
                  <ShareIcon className="h-5 w-5 mx-1 text-blue-500" />
                </span>{" "}
                Share button in Safari
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm">
                Scroll down and tap{" "}
                <span className="font-medium">&quot;Add to Home Screen&quot;</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div className="flex-1 pt-1">
              <p className="text-sm">
                Tap <span className="font-medium">&quot;Add&quot;</span> in the top right
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={dismissIOSPrompt} variant="outline" className="w-full">
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}

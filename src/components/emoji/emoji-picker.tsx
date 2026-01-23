"use client";

import { Suspense, lazy, useEffect, useState } from "react";

// Lazy load emoji-mart to reduce initial bundle (RESEARCH pitfall 3)
const Picker = lazy(() => import("@emoji-mart/react").then(mod => ({ default: mod.default })));

interface CustomEmojiData {
  id: string;
  name: string;
  path: string;
  isAnimated: boolean;
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void; // Native emoji or :custom_name:
  customEmojis?: CustomEmojiData[];
  autoFocus?: boolean;
  /** Number of emojis per row. Default 9, use 6 for mobile (larger targets). */
  perLine?: number;
}

export function EmojiPicker({ onSelect, customEmojis = [], autoFocus = false, perLine }: EmojiPickerProps) {
  const [data, setData] = useState<unknown>(null);

  // Lazy load emoji data
  useEffect(() => {
    import("@emoji-mart/data").then((mod) => {
      setData(mod.default);
    });
  }, []);

  if (!data) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  // Transform custom emojis to emoji-mart format
  // CONTEXT: Custom emoji section at top of picker
  const custom = customEmojis.length > 0 ? [{
    id: "workspace",
    name: "Workspace",
    emojis: customEmojis.map((e) => ({
      id: e.name, // Use name as ID for :name: syntax
      name: e.name,
      keywords: [e.name], // Searchable by name
      skins: [{ src: e.path }],
    })),
  }] : [];

  return (
    <Suspense
      fallback={
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <Picker
        data={data}
        custom={custom}
        onEmojiSelect={(emoji: { native?: string; id?: string; src?: string }) => {
          if (emoji.native) {
            // Standard Unicode emoji
            onSelect(emoji.native);
          } else if (emoji.id) {
            // Custom emoji - use :name: format (EMOJ-02)
            onSelect(`:${emoji.id}:`);
          }
        }}
        autoFocus={autoFocus}
        theme="auto" // Respects system/app dark mode
        set="native" // Use native emoji rendering
        previewPosition="none"
        skinTonePosition="search"
        maxFrequentRows={2}
        perLine={perLine}
        // CONTEXT: Recently used includes both standard and custom combined
        // emoji-mart handles this automatically with frequentlyUsed
      />
    </Suspense>
  );
}

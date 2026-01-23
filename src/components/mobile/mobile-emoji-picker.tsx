"use client";

import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { EmojiPicker } from "@/components/emoji/emoji-picker";

interface CustomEmojiData {
  id: string;
  name: string;
  path: string;
  isAnimated: boolean;
}

interface MobileEmojiPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
  customEmojis?: CustomEmojiData[];
}

/**
 * Mobile-optimized emoji picker using bottom sheet presentation.
 * Uses 6 columns for larger touch targets per 35-CONTEXT requirements.
 *
 * Features:
 * - Bottom sheet drawer for native mobile feel
 * - 6 emojis per row (larger targets than desktop's 9)
 * - Supports workspace custom emojis
 * - Auto-closes on selection
 */
export function MobileEmojiPicker({
  open,
  onOpenChange,
  onSelect,
  customEmojis = [],
}: MobileEmojiPickerProps) {
  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <div className="px-2 pb-4 pt-2">
          <EmojiPicker
            onSelect={handleSelect}
            customEmojis={customEmojis}
            perLine={6}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

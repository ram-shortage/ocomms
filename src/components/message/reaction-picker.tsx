"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { EmojiPicker } from "@/components/emoji/emoji-picker";

interface CustomEmojiData {
  id: string;
  name: string;
  path: string;
  isAnimated: boolean;
}

interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
  customEmojis?: CustomEmojiData[]; // Pass from parent
}

export function ReactionPicker({ onSelectEmoji, customEmojis = [] }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelectEmoji(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
          <SmilePlus className="h-4 w-4" />
          <span className="sr-only">Add reaction</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[352px] p-0 border-0" align="start">
        <EmojiPicker
          onSelect={handleSelect}
          customEmojis={customEmojis}
        />
      </PopoverContent>
    </Popover>
  );
}

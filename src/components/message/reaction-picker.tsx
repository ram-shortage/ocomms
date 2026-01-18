"use client";

import { EmojiPicker } from "frimousse";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SmilePlus } from "lucide-react";
import { useState } from "react";

interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
}

export function ReactionPicker({ onSelectEmoji }: ReactionPickerProps) {
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
      <PopoverContent className="w-[352px] p-0" align="start">
        <EmojiPicker.Root
          onEmojiSelect={(emoji) => handleSelect(emoji.emoji)}
          className="flex h-[300px] flex-col"
        >
          <EmojiPicker.Search
            className="mx-2 mt-2 rounded-md border px-3 py-2 text-sm"
            placeholder="Search emoji..."
          />
          <EmojiPicker.Viewport className="flex-1 overflow-y-auto p-2">
            <EmojiPicker.Loading className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading...
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No emoji found
            </EmojiPicker.Empty>
            <EmojiPicker.List
              className="select-none"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div {...props} className="px-1 pb-1 pt-3 text-xs font-medium text-muted-foreground">
                    {category.label}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    {...props}
                    className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-accent"
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </EmojiPicker.Viewport>
        </EmojiPicker.Root>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
  userNames: string[];
}

interface ReactionDisplayProps {
  reactions: Reaction[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
  /** EMOJ-02: Custom emojis for rendering :name: reactions as images */
  customEmojis?: Array<{ name: string; path: string }>;
}

// Check if emoji is custom format :name:
const CUSTOM_EMOJI_REGEX = /^:([a-zA-Z0-9_-]+):$/;

export function ReactionDisplay({ reactions, currentUserId, onToggle, customEmojis = [] }: ReactionDisplayProps) {
  if (reactions.length === 0) return null;

  // Build emoji lookup map
  const emojiMap = new Map(customEmojis.map((e) => [e.name, e.path]));

  // Render emoji - either as image (custom) or text (native)
  const renderEmoji = (emoji: string) => {
    const match = emoji.match(CUSTOM_EMOJI_REGEX);
    if (match) {
      const name = match[1];
      const path = emojiMap.get(name);
      if (path) {
        return (
          <img
            src={path}
            alt={emoji}
            title={emoji}
            className="inline-block h-4 w-4"
          />
        );
      }
    }
    // Native emoji or unknown custom emoji
    return <span>{emoji}</span>;
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1 mt-1">
        {reactions.map((reaction) => {
          const hasReacted = reaction.userIds.includes(currentUserId);
          const tooltipText = reaction.userNames.join(", ");

          return (
            <Tooltip key={reaction.emoji}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToggle(reaction.emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors",
                    hasReacted
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {renderEmoji(reaction.emoji)}
                  <span className="text-xs">{reaction.count}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{tooltipText}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

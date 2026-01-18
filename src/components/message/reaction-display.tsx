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
}

export function ReactionDisplay({ reactions, currentUserId, onToggle }: ReactionDisplayProps) {
  if (reactions.length === 0) return null;

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
                  <span>{reaction.emoji}</span>
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

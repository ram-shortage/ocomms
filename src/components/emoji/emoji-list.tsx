"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteCustomEmoji } from "@/lib/actions/custom-emoji";

interface CustomEmoji {
  id: string;
  name: string;
  path: string;
  isAnimated: boolean;
  uploadedBy: string;
  createdAt: Date;
}

interface EmojiListProps {
  emojis: CustomEmoji[];
  currentUserId: string;
  isAdmin: boolean;
  onDelete: () => void;
}

export function EmojiList({ emojis, currentUserId, isAdmin, onDelete }: EmojiListProps) {
  const handleDelete = async (emojiId: string) => {
    const result = await deleteCustomEmoji(emojiId);
    if (result.success) {
      onDelete();
    }
  };

  if (emojis.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No custom emoji yet. Upload one above!
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {emojis.map((emoji) => {
        const canDelete = emoji.uploadedBy === currentUserId || isAdmin;
        return (
          <div
            key={emoji.id}
            className="flex items-center gap-3 p-3 border rounded-lg"
          >
            <img
              src={emoji.path}
              alt={`:${emoji.name}:`}
              className="w-8 h-8 object-contain"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">:{emoji.name}:</p>
            </div>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                onClick={() => handleDelete(emoji.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { EmojiUploadForm } from "@/components/emoji/emoji-upload-form";
import { EmojiList } from "@/components/emoji/emoji-list";
import type { CustomEmoji } from "@/lib/actions/custom-emoji";

interface EmojiSettingsClientProps {
  workspaceId: string;
  workspaceSlug: string;
  currentUserId: string;
  isAdmin: boolean;
  initialEmojis: CustomEmoji[];
}

export function EmojiSettingsClient({
  workspaceId,
  workspaceSlug,
  currentUserId,
  isAdmin,
  initialEmojis,
}: EmojiSettingsClientProps) {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Custom Emoji</h1>

      {/* Upload form - admin only (CONTEXT decision) */}
      {isAdmin && (
        <div className="mb-8 p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Add Emoji</h2>
          <EmojiUploadForm
            workspaceId={workspaceId}
            onUploadComplete={handleRefresh}
          />
        </div>
      )}

      {/* Emoji list */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Workspace Emoji ({initialEmojis.length})</h2>
        <EmojiList
          emojis={initialEmojis}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onDelete={handleRefresh}
        />
      </div>

      <div className="pt-4">
        <Link
          href={`/${workspaceSlug}/settings`}
          className="text-sm text-primary hover:underline"
        >
          Back to settings
        </Link>
      </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useSocket } from "@/lib/socket-client";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { ThreadPanel } from "./thread-panel";
import type { Message } from "@/lib/socket-events";

interface ThreadPreview {
  threadId: string;
  parentContent: string;
  parentAuthorName: string | null;
  parentAuthorEmail: string;
  replyCount: number;
  lastReplyAt: Date;
  channelId: string | null;
  conversationId: string | null;
}

interface ThreadListProps {
  threads: ThreadPreview[];
  currentUserId: string;
  workspaceSlug: string;
}

export function ThreadList({ threads, currentUserId, workspaceSlug }: ThreadListProps) {
  const [selectedThread, setSelectedThread] = useState<Message | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const socket = useSocket();

  const handleThreadClick = useCallback((thread: ThreadPreview) => {
    // Convert ThreadPreview to Message format for the panel
    const parentMessage: Message = {
      id: thread.threadId,
      content: thread.parentContent,
      authorId: "", // We don't have this, but it's not critical for display
      channelId: thread.channelId,
      conversationId: thread.conversationId,
      parentId: null,
      replyCount: thread.replyCount,
      sequence: 0,
      deletedAt: null,
      createdAt: new Date(), // Not accurate but we have lastReplyAt
      updatedAt: new Date(),
      author: {
        id: "",
        name: thread.parentAuthorName,
        email: thread.parentAuthorEmail,
      },
    };
    setSelectedThread(parentMessage);
    setIsPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedThread(null);
  }, []);

  return (
    <>
      <div className="divide-y">
        {threads.map((thread) => (
          <button
            key={thread.threadId}
            onClick={() => handleThreadClick(thread)}
            className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Avatar placeholder */}
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium shrink-0">
                {thread.parentAuthorName?.[0]?.toUpperCase() || thread.parentAuthorEmail[0]?.toUpperCase() || "?"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 text-sm">
                    {thread.parentAuthorName || thread.parentAuthorEmail}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(thread.lastReplyAt), { addSuffix: true })}
                  </span>
                </div>

                <p className="text-gray-700 text-sm line-clamp-2 mb-2">
                  {thread.parentContent}
                </p>

                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>
                    {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <ThreadPanel
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        parentMessage={selectedThread}
        currentUserId={currentUserId}
      />
    </>
  );
}

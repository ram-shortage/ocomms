"use client";

import { useState, useEffect, useCallback, useRef, FormEvent, KeyboardEvent } from "react";
import { useSocket } from "@/lib/socket-client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Message } from "@/lib/socket-events";
import { MessageContent } from "@/components/message/message-content";

interface ThreadPanelProps {
  isOpen: boolean;
  onClose: () => void;
  parentMessage: Message | null;
  currentUserId: string;
  currentUsername?: string;
}

function ThreadReplyItem({ message, currentUsername }: { message: Message; currentUsername?: string }) {
  const isDeleted = message.deletedAt !== null && message.deletedAt !== undefined;

  return (
    <div className="flex items-start gap-3 py-2 px-4 hover:bg-gray-50 rounded-lg">
      {/* Avatar placeholder */}
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium shrink-0">
        {message.author?.name?.[0]?.toUpperCase() || message.author?.email?.[0]?.toUpperCase() || "?"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-gray-900 text-sm">
            {message.author?.name || message.author?.email || "Unknown"}
          </span>
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
        </div>

        {isDeleted ? (
          <p className="text-gray-400 italic text-sm">[Message deleted]</p>
        ) : (
          <div className="text-sm">
            <MessageContent content={message.content} currentUsername={currentUsername} />
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadReplyInput({
  parentId,
  onReplySent,
}: {
  parentId: string;
  onReplySent: () => void;
}) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const socket = useSocket();

  const sendReply = useCallback(() => {
    if (!content.trim() || isSending) return;

    setIsSending(true);
    socket.emit(
      "thread:reply",
      { parentId, content: content.trim() },
      (response) => {
        setIsSending(false);
        if (response.success) {
          setContent("");
          onReplySent();
        }
      }
    );
  }, [content, isSending, socket, parentId, onReplySent]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendReply();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-3">
      <div className="flex gap-2 items-end">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply in thread..."
          disabled={isSending}
          className="min-h-[40px] max-h-[150px] resize-none text-sm"
          rows={1}
        />
        <Button
          type="submit"
          disabled={!content.trim() || isSending}
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send reply</span>
        </Button>
      </div>
    </form>
  );
}

export function ThreadPanel({ isOpen, onClose, parentMessage, currentUserId, currentUsername }: ThreadPanelProps) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const socket = useSocket();
  const repliesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when replies change
  const scrollToBottom = useCallback(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Join thread room and fetch replies when panel opens
  useEffect(() => {
    if (!isOpen || !parentMessage) return;

    const threadId = parentMessage.id;
    setLoading(true);
    setReplies([]);

    // Join thread room
    socket.emit("thread:join", { threadId });

    // Fetch existing replies
    socket.emit("thread:getReplies", { threadId }, (response) => {
      setLoading(false);
      if (response.success && response.replies) {
        setReplies(response.replies);
        // Scroll to bottom after loading
        setTimeout(scrollToBottom, 100);
      }
    });

    // Listen for new replies
    const handleNewReply = (data: Message) => {
      if (data.parentId === threadId) {
        setReplies((prev) => [...prev, data]);
        setTimeout(scrollToBottom, 100);
      }
    };

    // Listen for message deletions in thread
    const handleDeleted = (data: { messageId: string; deletedAt: Date }) => {
      setReplies((prev) =>
        prev.map((r) =>
          r.id === data.messageId ? { ...r, deletedAt: data.deletedAt } : r
        )
      );
    };

    socket.on("thread:newReply", handleNewReply);
    socket.on("message:deleted", handleDeleted);

    return () => {
      socket.emit("thread:leave", { threadId });
      socket.off("thread:newReply", handleNewReply);
      socket.off("message:deleted", handleDeleted);
    };
  }, [isOpen, parentMessage?.id, socket, scrollToBottom]);

  // Handler after sending reply - just scroll to bottom
  const handleReplySent = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  if (!parentMessage) return null;

  const parentIsDeleted = parentMessage.deletedAt !== null && parentMessage.deletedAt !== undefined;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[450px] p-0 flex flex-col" side="right">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle>Thread</SheetTitle>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Parent message */}
        <div className="border-b bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium shrink-0">
              {parentMessage.author?.name?.[0]?.toUpperCase() || parentMessage.author?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-gray-900">
                  {parentMessage.author?.name || parentMessage.author?.email || "Unknown"}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(parentMessage.createdAt), { addSuffix: true })}
                </span>
              </div>
              {parentIsDeleted ? (
                <p className="text-gray-400 italic">[Message deleted]</p>
              ) : (
                <MessageContent content={parentMessage.content} currentUsername={currentUsername} />
              )}
            </div>
          </div>
        </div>

        {/* Replies list */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              Loading replies...
            </div>
          ) : replies.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              No replies yet
            </div>
          ) : (
            <>
              <div className="px-4 py-2 text-xs text-gray-500 font-medium">
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </div>
              {replies.map((reply) => (
                <ThreadReplyItem key={reply.id} message={reply} currentUsername={currentUsername} />
              ))}
              <div ref={repliesEndRef} />
            </>
          )}
        </div>

        {/* Reply input */}
        <ThreadReplyInput parentId={parentMessage.id} onReplySent={handleReplySent} />
      </SheetContent>
    </Sheet>
  );
}

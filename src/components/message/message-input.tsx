"use client";

import { useState, useCallback, FormEvent, KeyboardEvent } from "react";
import { useSocket } from "@/lib/socket-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface MessageInputProps {
  targetId: string;
  targetType: "channel" | "dm";
}

export function MessageInput({ targetId, targetType }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const socket = useSocket();

  const sendMessage = useCallback(() => {
    if (!content.trim() || isSending) return;

    setIsSending(true);
    socket.emit(
      "message:send",
      { targetId, targetType, content: content.trim() },
      (response) => {
        setIsSending(false);
        if (response.success) {
          setContent("");
        }
      }
    );
  }, [content, isSending, socket, targetId, targetType]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-4">
      <div className="flex gap-2 items-end">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            targetType === "channel"
              ? "Type a message..."
              : "Type a message..."
          }
          disabled={isSending}
          className="min-h-[44px] max-h-[200px] resize-none"
          rows={1}
        />
        <Button
          type="submit"
          disabled={!content.trim() || isSending}
          className="h-11 w-11 p-0 shrink-0"
        >
          <Send className="h-5 w-5" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>
    </form>
  );
}

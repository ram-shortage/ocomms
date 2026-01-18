"use client";

import { useState, useCallback, useRef, useEffect, FormEvent, KeyboardEvent, ChangeEvent } from "react";
import { useSocket } from "@/lib/socket-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { MentionAutocomplete, type MentionMember } from "./mention-autocomplete";
import { formatMentionForInsert } from "@/lib/mentions";

const MAX_MESSAGE_LENGTH = 10_000;

interface MessageInputProps {
  targetId: string;
  targetType: "channel" | "dm";
  members?: MentionMember[];
}

export function MessageInput({ targetId, targetType, members = [] }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState<number | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socket = useSocket();

  // SECFIX-06: Listen for rate limit errors
  useEffect(() => {
    const handleError = (data: { message: string; code?: string; retryAfter?: number }) => {
      if (data.code === "RATE_LIMITED") {
        setRateLimitMessage(data.message);
        // Clear after retryAfter seconds (or 60s default)
        setTimeout(() => {
          setRateLimitMessage(null);
        }, (data.retryAfter ?? 60) * 1000);
      }
    };

    socket.on("error", handleError);
    return () => {
      socket.off("error", handleError);
    };
  }, [socket]);

  // SECFIX-05: Character limit validation
  const isOverLimit = content.length > MAX_MESSAGE_LENGTH;
  const isSendDisabled = !content.trim() || isSending || isOverLimit || rateLimitMessage !== null;

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
    if (mentionQuery === null) {
      sendMessage();
    }
  };

  const closeMentionAutocomplete = useCallback(() => {
    setMentionQuery(null);
    setMentionPosition(null);
    setMentionTriggerIndex(null);
  }, []);

  const handleMentionSelect = useCallback((value: string) => {
    if (mentionTriggerIndex === null) return;

    // Replace @query with formatted mention
    const beforeMention = content.slice(0, mentionTriggerIndex);
    const afterMention = content.slice(
      mentionTriggerIndex + 1 + (mentionQuery?.length || 0)
    );
    const formattedMention = formatMentionForInsert(value);

    const newContent = beforeMention + formattedMention + " " + afterMention;
    setContent(newContent);
    closeMentionAutocomplete();

    // Refocus textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const cursorPos = beforeMention.length + formattedMention.length + 1;
        textareaRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    }, 0);
  }, [content, mentionTriggerIndex, mentionQuery, closeMentionAutocomplete]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(newValue);

    // Check for @ trigger
    // Look backwards from cursor to find @ not preceded by alphanumeric
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(^|[^a-zA-Z0-9])@([a-zA-Z0-9._-]*)$/);

    if (atMatch) {
      const query = atMatch[2];
      const triggerIndex = textBeforeCursor.lastIndexOf("@");

      // Calculate position for dropdown (above the textarea)
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        // Position above the input
        setMentionPosition({
          top: 8, // distance from bottom of dropdown to top of textarea
          left: 0,
        });
      }

      setMentionQuery(query);
      setMentionTriggerIndex(triggerIndex);
    } else {
      closeMentionAutocomplete();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // If mention autocomplete is open, let it handle navigation keys
    if (mentionQuery !== null) {
      if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
        // These are handled by MentionAutocomplete's document listener
        // Prevent default behaviors
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
        }
        return;
      }
    }

    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t bg-white p-4">
      <div className="relative flex gap-2 items-end">
        {mentionQuery !== null && mentionPosition && members.length > 0 && (
          <MentionAutocomplete
            members={members}
            filter={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={closeMentionAutocomplete}
            position={mentionPosition}
          />
        )}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            targetType === "channel"
              ? "Type a message..."
              : "Type a message..."
          }
          disabled={isSending || rateLimitMessage !== null}
          className="min-h-[44px] max-h-[200px] resize-none"
          rows={1}
        />
        <Button
          type="submit"
          disabled={isSendDisabled}
          className="h-11 w-11 p-0 shrink-0"
        >
          <Send className="h-5 w-5" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>

      {/* SECFIX-05: Character counter - always visible per CONTEXT.md */}
      <div className="flex justify-between items-center mt-1 px-1">
        <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
          {content.length.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
        </span>
        {isOverLimit && (
          <span className="text-xs text-red-500">
            Message too long
          </span>
        )}
      </div>

      {/* SECFIX-06: Rate limit message - inline below input per CONTEXT.md */}
      {rateLimitMessage && (
        <div className="text-sm text-amber-600 mt-2 px-1">
          {rateLimitMessage}
        </div>
      )}
    </form>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect, FormEvent, KeyboardEvent, ChangeEvent, ClipboardEvent } from "react";
import { useSocket } from "@/lib/socket-client";
import { useSendMessage } from "@/hooks/use-send-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, ImageIcon, FileIcon } from "lucide-react";
import { MentionAutocomplete, type MentionMember } from "./mention-autocomplete";
import { formatMentionForInsert } from "@/lib/mentions";
import { FileUploadZone } from "./file-upload-zone";
import { UploadProgress } from "./upload-progress";
import { uploadFile, type UploadResult } from "@/lib/upload-file";
import { useTyping } from "@/lib/hooks/use-typing";
import { TypingIndicator } from "./typing-indicator";

const MAX_MESSAGE_LENGTH = 10_000;

interface PendingUpload {
  file: File;
  progress: number;
  abortController: AbortController;
  result?: UploadResult;
  error?: string;
}

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

  // File upload state
  const [pendingUploads, setPendingUploads] = useState<Map<string, PendingUpload>>(new Map());
  const [stagedAttachments, setStagedAttachments] = useState<UploadResult[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Offline send queue hook
  const { sendMessage: queueAndSend, isOnline } = useSendMessage({ targetId, targetType });

  // Typing indicator hook
  const { emitTyping, stopTyping } = useTyping(targetId, targetType);

  // Clear upload error after 5 seconds
  useEffect(() => {
    if (uploadError) {
      const timer = setTimeout(() => setUploadError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadError]);

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
  const hasContent = content.trim() || stagedAttachments.length > 0;
  const isSendDisabled = !hasContent || isSending || isOverLimit || rateLimitMessage !== null;

  // Handle file selection (from drag-drop or click-to-browse)
  const handleFilesSelected = useCallback((files: File[]) => {
    for (const file of files) {
      const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const abortController = new AbortController();

      // Add to pending uploads
      setPendingUploads((prev) => {
        const next = new Map(prev);
        next.set(clientId, {
          file,
          progress: 0,
          abortController,
        });
        return next;
      });

      // Start upload
      uploadFile(file, {
        onProgress: (percent) => {
          setPendingUploads((prev) => {
            const next = new Map(prev);
            const upload = next.get(clientId);
            if (upload) {
              next.set(clientId, { ...upload, progress: percent });
            }
            return next;
          });
        },
        signal: abortController.signal,
      })
        .then((result) => {
          // Remove from pending, add to staged
          setPendingUploads((prev) => {
            const next = new Map(prev);
            next.delete(clientId);
            return next;
          });
          setStagedAttachments((prev) => [...prev, result]);
        })
        .catch((err) => {
          // Remove from pending, show error
          setPendingUploads((prev) => {
            const next = new Map(prev);
            next.delete(clientId);
            return next;
          });
          // Don't show error for cancelled uploads
          if (err.message !== "Upload cancelled") {
            setUploadError(err.message || "Upload failed");
          }
        });
    }
  }, []);

  // Handle cancel upload
  const handleCancelUpload = useCallback((clientId: string) => {
    setPendingUploads((prev) => {
      const upload = prev.get(clientId);
      if (upload) {
        upload.abortController.abort();
      }
      const next = new Map(prev);
      next.delete(clientId);
      return next;
    });
  }, []);

  // Handle remove staged attachment
  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setStagedAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }, []);

  // Handle clipboard paste for images (FILE-10)
  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFilesSelected(imageFiles);
    }
  }, [handleFilesSelected]);

  const sendMessage = useCallback(async () => {
    if (!hasContent || isSending) return;

    setIsSending(true);
    try {
      // Include attachment IDs if any staged
      const attachmentIds = stagedAttachments.map((a) => a.id);
      await queueAndSend(content.trim(), attachmentIds.length > 0 ? attachmentIds : undefined);
      // Clear input and attachments immediately (optimistic UI)
      setContent("");
      setStagedAttachments([]);
      // TYPE-04: Stop typing immediately on send
      stopTyping();
    } catch (err) {
      console.error("[MessageInput] Failed to queue message:", err);
    } finally {
      setIsSending(false);
    }
  }, [content, hasContent, isSending, queueAndSend, stagedAttachments]);

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

    // Emit typing indicator (throttled in hook)
    if (newValue.trim()) {
      emitTyping();
    }

    // Check for @ trigger
    // Look backwards from cursor to find @ not preceded by alphanumeric
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/(^|[^a-zA-Z0-9])@([a-zA-Z0-9._-]*)$/);

    if (atMatch) {
      const query = atMatch[2];
      const triggerIndex = textBeforeCursor.lastIndexOf("@");

      // Calculate position for dropdown (above the textarea)
      if (textareaRef.current) {
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

  const isUploading = pendingUploads.size > 0;

  return (
    <form onSubmit={handleSubmit} className="border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Pending uploads */}
      {pendingUploads.size > 0 && (
        <div className="mb-2 space-y-2">
          {Array.from(pendingUploads.entries()).map(([clientId, upload]) => (
            <UploadProgress
              key={clientId}
              filename={upload.file.name}
              progress={upload.progress}
              isImage={upload.file.type.startsWith("image/")}
              onCancel={() => handleCancelUpload(clientId)}
            />
          ))}
        </div>
      )}

      {/* Staged attachments */}
      {stagedAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {stagedAttachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md text-sm"
            >
              {attachment.isImage ? (
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="truncate max-w-[150px]" title={attachment.originalName}>
                {attachment.originalName}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="h-5 w-5 ml-1"
                title="Remove attachment"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remove attachment</span>
              </Button>
            </div>
          ))}
        </div>
      )}

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
        <FileUploadZone
          onFilesSelected={handleFilesSelected}
          disabled={isSending || rateLimitMessage !== null}
        />
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
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
        <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
          {content.length.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
        </span>
        {isOverLimit && (
          <span className="text-xs text-red-500">
            Message too long
          </span>
        )}
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="text-sm text-red-500 mt-1 px-1">
          {uploadError}
        </div>
      )}

      {/* Offline indicator */}
      {!isOnline && (
        <div className="text-xs text-muted-foreground mt-1 px-1">
          (offline - will send when connected)
        </div>
      )}

      {/* SECFIX-06: Rate limit message - inline below input per CONTEXT.md */}
      {rateLimitMessage && (
        <div className="text-sm text-amber-600 mt-2 px-1">
          {rateLimitMessage}
        </div>
      )}

      {/* Typing indicator */}
      <TypingIndicator targetId={targetId} />
    </form>
  );
}

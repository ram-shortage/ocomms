"use client";

import { useState, useCallback, useRef, useEffect, FormEvent, KeyboardEvent, ChangeEvent, ClipboardEvent } from "react";
import { useSocket } from "@/lib/socket-client";
import { useSendMessage } from "@/hooks/use-send-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, ImageIcon, FileIcon, SmilePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmojiPicker } from "@/components/emoji/emoji-picker";
import { MentionAutocomplete, type MentionMember, type MentionGroup } from "./mention-autocomplete";
import { formatMentionForInsert } from "@/lib/mentions";
import { FileUploadZone } from "./file-upload-zone";
import { UploadProgress } from "./upload-progress";
import { uploadFile, type UploadResult } from "@/lib/upload-file";
import { useTyping } from "@/lib/hooks/use-typing";
import { TypingIndicator } from "./typing-indicator";
import { ScheduleSendDropdown } from "@/components/schedule/schedule-send-dropdown";
import { createScheduledMessage } from "@/lib/actions/scheduled-message";
import { format, isToday, isTomorrow } from "date-fns";

const MAX_MESSAGE_LENGTH = 10_000;

interface PendingUpload {
  file: File;
  progress: number;
  abortController: AbortController;
  result?: UploadResult;
  error?: string;
}

interface CustomEmojiData {
  id: string;
  name: string;
  path: string;
  isAnimated: boolean;
}

interface MessageInputProps {
  targetId: string;
  targetType: "channel" | "dm";
  members?: MentionMember[];
  groups?: MentionGroup[];
  customEmojis?: CustomEmojiData[];
}

export function MessageInput({ targetId, targetType, members = [], groups = [], customEmojis = [] }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
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

  // Schedule feedback state
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);

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
  }, [content, hasContent, isSending, queueAndSend, stagedAttachments, stopTyping]);

  // Handle schedule send
  const handleSchedule = useCallback(async (scheduledFor: Date) => {
    if (!content.trim() || isSending) return;

    setIsSending(true);
    try {
      // Create scheduled message
      await createScheduledMessage({
        content: content.trim(),
        scheduledFor,
        channelId: targetType === "channel" ? targetId : undefined,
        conversationId: targetType === "dm" ? targetId : undefined,
      });

      // Clear input
      setContent("");
      stopTyping();

      // Show success feedback
      const timeLabel = isToday(scheduledFor)
        ? `today at ${format(scheduledFor, "h:mm a")}`
        : isTomorrow(scheduledFor)
          ? `tomorrow at ${format(scheduledFor, "h:mm a")}`
          : format(scheduledFor, "MMM d 'at' h:mm a");
      setScheduleMessage(`Message scheduled for ${timeLabel}`);

      // Clear feedback after 4 seconds
      setTimeout(() => setScheduleMessage(null), 4000);
    } catch (err) {
      console.error("[MessageInput] Failed to schedule message:", err);
      setScheduleMessage(err instanceof Error ? err.message : "Failed to schedule message");
      setTimeout(() => setScheduleMessage(null), 4000);
    } finally {
      setIsSending(false);
    }
  }, [content, isSending, targetId, targetType, stopTyping]);

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
    <form onSubmit={handleSubmit} className="border-t bg-background px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
        {mentionQuery !== null && mentionPosition && (members.length > 0 || groups.length > 0) && (
          <MentionAutocomplete
            members={members}
            groups={groups}
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
          placeholder="Type a message..."
          disabled={isSending || rateLimitMessage !== null}
          className="!min-h-0 h-10 max-h-[200px] resize-none py-2"
          rows={1}
        />
        {/* Emoji picker button (EMOJ-02) */}
        <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <SmilePlus className="h-4 w-4" />
              <span className="sr-only">Insert emoji</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[352px] p-0 border-0" align="end">
            <EmojiPicker
              onSelect={(emoji) => {
                // Insert emoji at cursor position or append
                setContent((prev) => prev + emoji);
                setEmojiPickerOpen(false);
              }}
              customEmojis={customEmojis}
            />
          </PopoverContent>
        </Popover>
        <ScheduleSendDropdown
          onSendNow={sendMessage}
          onSchedule={handleSchedule}
          disabled={isSendDisabled}
        />
      </div>

      {/* Footer row: character counter, typing indicator, and status messages */}
      <div className="flex items-center gap-2 mt-1 px-1 min-h-[18px]">
        <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
          {content.length.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
        </span>
        {isOverLimit && <span className="text-xs text-red-500">Message too long</span>}
        {uploadError && <span className="text-xs text-red-500">{uploadError}</span>}
        {!isOnline && <span className="text-xs text-muted-foreground">(offline)</span>}
        {rateLimitMessage && <span className="text-xs text-amber-600">{rateLimitMessage}</span>}
        {scheduleMessage && <span className="text-xs text-emerald-600">{scheduleMessage}</span>}
        <TypingIndicator targetId={targetId} />
      </div>
    </form>
  );
}

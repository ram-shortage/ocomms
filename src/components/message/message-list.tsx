"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/lib/socket-client";
import { MessageItem } from "./message-item";
import { ThreadPanel } from "../thread/thread-panel";
import type { Message, ReactionGroup } from "@/lib/socket-events";
import {
  cacheMessage,
  cacheMessages,
  updateMessageDeletion,
  useCachedChannelMessages,
  useCachedConversationMessages,
  useSendQueue,
} from "@/lib/cache";
import { useOnlineStatus } from "@/lib/pwa/use-online-status";

interface MessageListProps {
  initialMessages: Message[];
  targetId: string;
  targetType: "channel" | "dm";
  currentUserId: string;
  currentUsername?: string;
  pinnedMessageIds?: Set<string>;
  onPin?: (messageId: string) => void;
  onUnpin?: (messageId: string) => void;
  onMarkUnread?: (messageId: string) => void;
}

// Track reactions per message
type ReactionsMap = Record<string, ReactionGroup[]>;

export function MessageList({
  initialMessages,
  targetId,
  targetType,
  currentUserId,
  currentUsername,
  pinnedMessageIds,
  onPin,
  onUnpin,
  onMarkUnread,
}: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({});
  const [selectedThread, setSelectedThread] = useState<Message | null>(null);
  const [isThreadPanelOpen, setIsThreadPanelOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();

  // Offline support: online status and cached messages
  const { isOnline } = useOnlineStatus();
  const cachedChannelMessages = useCachedChannelMessages(
    targetType === "channel" ? targetId : null
  );
  const cachedConversationMessages = useCachedConversationMessages(
    targetType === "dm" ? targetId : null
  );

  // Pending messages from send queue (optimistic UI)
  const pendingMessages = useSendQueue(targetId);

  // Cache initial messages on mount (fire-and-forget, don't block rendering)
  useEffect(() => {
    if (initialMessages.length > 0) {
      cacheMessages(initialMessages);
    }
  }, [initialMessages]);

  // Scroll to bottom when messages or pending messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingMessages]);

  // Fetch reactions for all messages on mount and when messages change
  useEffect(() => {
    const messageIds = messages.map((m) => m.id);

    for (const messageId of messageIds) {
      // Skip if we already have reactions for this message
      if (reactionsMap[messageId] !== undefined) continue;

      socket.emit("reaction:get", { messageId }, (response) => {
        if (response.success && response.reactions) {
          setReactionsMap((prev) => ({
            ...prev,
            [messageId]: response.reactions!,
          }));
        }
      });
    }
  }, [messages, socket, reactionsMap]);

  // Subscribe to real-time message events
  useEffect(() => {
    function handleNewMessage(message: Message) {
      // Check if this message belongs to our target
      const belongsToTarget =
        (targetType === "channel" && message.channelId === targetId) ||
        (targetType === "dm" && message.conversationId === targetId);

      if (belongsToTarget) {
        setMessages((prev) => [...prev, message]);
        // Cache the new message (fire and forget)
        cacheMessage(message);
        // Initialize empty reactions for new message
        setReactionsMap((prev) => ({
          ...prev,
          [message.id]: [],
        }));
      }
    }

    function handleDeletedMessage(data: { messageId: string; deletedAt: Date }) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, deletedAt: data.deletedAt }
            : msg
        )
      );
      // Update cache with deletion (fire and forget)
      updateMessageDeletion(data.messageId, data.deletedAt);
    }

    function handleReactionUpdate(data: {
      messageId: string;
      emoji: string;
      userId: string;
      userName: string;
      action: "added" | "removed";
    }) {
      setReactionsMap((prev) => {
        const messageReactions = [...(prev[data.messageId] || [])];
        const existingIndex = messageReactions.findIndex((r) => r.emoji === data.emoji);

        if (data.action === "added") {
          if (existingIndex >= 0) {
            // Add user to existing reaction group
            const existing = messageReactions[existingIndex];
            if (!existing.userIds.includes(data.userId)) {
              messageReactions[existingIndex] = {
                ...existing,
                count: existing.count + 1,
                userIds: [...existing.userIds, data.userId],
                userNames: [...existing.userNames, data.userName],
              };
            }
          } else {
            // Create new reaction group
            messageReactions.push({
              emoji: data.emoji,
              count: 1,
              userIds: [data.userId],
              userNames: [data.userName],
            });
          }
        } else {
          // action === "removed"
          if (existingIndex >= 0) {
            const existing = messageReactions[existingIndex];
            const userIndex = existing.userIds.indexOf(data.userId);
            if (userIndex >= 0) {
              if (existing.count === 1) {
                // Remove the entire reaction group
                messageReactions.splice(existingIndex, 1);
              } else {
                // Remove user from reaction group
                messageReactions[existingIndex] = {
                  ...existing,
                  count: existing.count - 1,
                  userIds: existing.userIds.filter((id) => id !== data.userId),
                  userNames: existing.userNames.filter((_, i) => i !== userIndex),
                };
              }
            }
          }
        }

        return {
          ...prev,
          [data.messageId]: messageReactions,
        };
      });
    }

    function handleReplyCount(data: { messageId: string; replyCount: number }) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, replyCount: data.replyCount }
            : msg
        )
      );
      // Also update selectedThread if it matches
      setSelectedThread((prev) =>
        prev?.id === data.messageId
          ? { ...prev, replyCount: data.replyCount }
          : prev
      );
    }

    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleDeletedMessage);
    socket.on("reaction:update", handleReactionUpdate);
    socket.on("message:replyCount", handleReplyCount);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleDeletedMessage);
      socket.off("reaction:update", handleReactionUpdate);
      socket.off("message:replyCount", handleReplyCount);
    };
  }, [socket, targetId, targetType]);

  const handleDelete = useCallback(
    (messageId: string) => {
      socket.emit("message:delete", { messageId });
    },
    [socket]
  );

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      socket.emit("reaction:toggle", { messageId, emoji });
    },
    [socket]
  );

  const handleReply = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        setSelectedThread(message);
        setIsThreadPanelOpen(true);
      }
    },
    [messages]
  );

  const handleCloseThreadPanel = useCallback(() => {
    setIsThreadPanelOpen(false);
    setSelectedThread(null);
  }, []);

  // When offline, fall back to cached messages
  const serverMessages = isOnline
    ? messages // Real-time state (existing behavior)
    : targetType === "channel"
      ? cachedChannelMessages
      : cachedConversationMessages;

  // For offline display, reconstruct author object from cached data
  // CachedMessage has flattened authorName/authorEmail, but MessageItem expects author object
  const normalizedServerMessages = serverMessages.map((msg) => ({
    ...msg,
    author:
      "authorName" in msg
        ? { id: msg.authorId, name: msg.authorName, email: msg.authorEmail }
        : msg.author,
  }));

  // Convert pending messages to display format (optimistic UI)
  // These are messages queued locally but not yet confirmed by server
  const normalizedPendingMessages = pendingMessages.map((msg) => ({
    id: msg.clientId, // Use clientId as temporary ID
    content: msg.content,
    authorId: currentUserId,
    author: { id: currentUserId, name: currentUsername ?? null, email: "" },
    channelId: msg.targetType === "channel" ? msg.targetId : null,
    conversationId: msg.targetType === "dm" ? msg.targetId : null,
    parentId: msg.parentId,
    replyCount: 0,
    sequence: 0,
    deletedAt: null,
    createdAt: msg.createdAt,
    updatedAt: msg.createdAt,
    // Mark as pending for UI styling
    _isPending: true,
    _status: msg.status,
  }));

  // Merge server messages with pending messages
  // Filter out pending messages that have been confirmed (matching serverId)
  const confirmedServerIds = new Set(normalizedServerMessages.map((m) => m.id));
  const filteredPending = normalizedPendingMessages.filter(
    (m) => !pendingMessages.some((p) => p.serverId && confirmedServerIds.has(p.serverId))
  );

  // Combine and sort by createdAt
  const normalizedMessages = [...normalizedServerMessages, ...filteredPending].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (normalizedMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>No messages yet. Be the first to say something!</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto py-4">
        {normalizedMessages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            onDelete={handleDelete}
            reactions={reactionsMap[message.id] || []}
            onToggleReaction={handleToggleReaction}
            onReply={handleReply}
            isPinned={pinnedMessageIds?.has(message.id) ?? false}
            onPin={onPin}
            onUnpin={onUnpin}
            isChannelMessage={targetType === "channel"}
            onMarkUnread={onMarkUnread}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <ThreadPanel
        isOpen={isThreadPanelOpen}
        onClose={handleCloseThreadPanel}
        parentMessage={selectedThread}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
      />
    </>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "@/lib/socket-client";

interface UnreadCounts {
  channels: Record<string, number>;
  conversations: Record<string, number>;
}

interface UseUnreadCountsResult {
  channelUnreads: Record<string, number>;
  conversationUnreads: Record<string, number>;
  isLoading: boolean;
}

/**
 * Hook to fetch and subscribe to unread counts for channels and/or conversations.
 *
 * @param channelIds - Array of channel IDs to track
 * @param conversationIds - Optional array of conversation IDs to track
 * @returns Object with channelUnreads, conversationUnreads, and isLoading
 */
export function useUnreadCounts(
  channelIds: string[],
  conversationIds?: string[]
): UseUnreadCountsResult {
  const socket = useSocket();
  const [counts, setCounts] = useState<UnreadCounts>({
    channels: {},
    conversations: {},
  });
  const [isLoading, setIsLoading] = useState(true);

  // Track if we've already fetched for these IDs
  const fetchedRef = useRef<string>("");
  const idsKey = [...channelIds, ...(conversationIds || [])].sort().join(",");

  // Fetch initial counts
  useEffect(() => {
    // Skip if no IDs to fetch
    if (channelIds.length === 0 && (!conversationIds || conversationIds.length === 0)) {
      setIsLoading(false);
      return;
    }

    // Skip if we already fetched for these IDs
    if (fetchedRef.current === idsKey) {
      return;
    }

    fetchedRef.current = idsKey;
    setIsLoading(true);

    socket.emit(
      "unread:fetch",
      {
        channelIds: channelIds.length > 0 ? channelIds : undefined,
        conversationIds: conversationIds && conversationIds.length > 0 ? conversationIds : undefined,
      },
      (response) => {
        setCounts({
          channels: response.channels,
          conversations: response.conversations,
        });
        setIsLoading(false);
      }
    );
  }, [socket, channelIds, conversationIds, idsKey]);

  // Subscribe to real-time unread updates
  useEffect(() => {
    function handleUnreadUpdate(data: {
      channelId?: string;
      conversationId?: string;
      unreadCount: number;
    }) {
      if (data.channelId && channelIds.includes(data.channelId)) {
        setCounts((prev) => ({
          ...prev,
          channels: {
            ...prev.channels,
            [data.channelId!]: data.unreadCount,
          },
        }));
      }
      if (data.conversationId && conversationIds?.includes(data.conversationId)) {
        setCounts((prev) => ({
          ...prev,
          conversations: {
            ...prev.conversations,
            [data.conversationId!]: data.unreadCount,
          },
        }));
      }
    }

    socket.on("unread:update", handleUnreadUpdate);

    return () => {
      socket.off("unread:update", handleUnreadUpdate);
    };
  }, [socket, channelIds, conversationIds]);

  return {
    channelUnreads: counts.channels,
    conversationUnreads: counts.conversations,
    isLoading,
  };
}

/**
 * Hook to mark a channel or conversation as read.
 *
 * @returns Function to mark as read: (channelId?, conversationId?) => void
 */
export function useMarkAsRead(): (
  channelId?: string,
  conversationId?: string
) => void {
  const socket = useSocket();

  return useCallback(
    (channelId?: string, conversationId?: string) => {
      if (!channelId && !conversationId) return;

      socket.emit(
        "unread:markRead",
        { channelId, conversationId },
        (response) => {
          if (!response.success) {
            console.error("Failed to mark as read");
          }
        }
      );
    },
    [socket]
  );
}

/**
 * Hook to mark a message as unread (sets unread state to that message).
 *
 * @returns Function to mark message as unread: (messageId) => void
 */
export function useMarkMessageUnread(): (messageId: string) => void {
  const socket = useSocket();

  return useCallback(
    (messageId: string) => {
      socket.emit(
        "unread:markMessageUnread",
        { messageId },
        (response) => {
          if (!response.success) {
            console.error("Failed to mark message as unread");
          }
        }
      );
    },
    [socket]
  );
}

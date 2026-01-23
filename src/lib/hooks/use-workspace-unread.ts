"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/lib/socket-client";

interface UseWorkspaceUnreadCountsResult {
  counts: Record<string, number>;
  isLoading: boolean;
}

/**
 * Hook to fetch and subscribe to workspace-level unread counts.
 * Aggregates unread counts from all channels and conversations in each workspace.
 *
 * @param workspaceIds - Array of workspace (organization) IDs to track
 * @returns Object with counts (workspaceId -> unread count) and isLoading
 */
export function useWorkspaceUnreadCounts(
  workspaceIds: string[]
): UseWorkspaceUnreadCountsResult {
  const socket = useSocket();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Track if we've already fetched for these IDs
  const fetchedRef = useRef<string>("");
  const idsKey = [...workspaceIds].sort().join(",");

  // Fetch initial counts
  useEffect(() => {
    // Skip if no IDs to fetch
    if (workspaceIds.length === 0) {
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
      "workspace:fetchUnreads",
      { workspaceIds },
      (response) => {
        setCounts(response.counts);
        setIsLoading(false);
      }
    );
  }, [socket, workspaceIds, idsKey]);

  // Subscribe to real-time workspace unread updates
  useEffect(() => {
    function handleWorkspaceUnreadUpdate(data: {
      workspaceId: string;
      unreadCount: number;
    }) {
      // Only update if this workspace is in our tracked list
      if (workspaceIds.includes(data.workspaceId)) {
        setCounts((prev) => ({
          ...prev,
          [data.workspaceId]: data.unreadCount,
        }));
      }
    }

    socket.on("workspace:unreadUpdate", handleWorkspaceUnreadUpdate);

    return () => {
      socket.off("workspace:unreadUpdate", handleWorkspaceUnreadUpdate);
    };
  }, [socket, workspaceIds]);

  return {
    counts,
    isLoading,
  };
}

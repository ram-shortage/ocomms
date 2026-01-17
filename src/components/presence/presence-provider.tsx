"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSocket } from "@/lib/socket-client";
import type { PresenceStatus } from "./presence-indicator";

interface PresenceContextValue {
  /** Map of userId -> presence status */
  presenceMap: Record<string, PresenceStatus>;
  /** Get a user's presence status (defaults to "offline") */
  getPresence: (userId: string) => PresenceStatus;
  /** Manually refresh presence for a list of users */
  refreshPresence: (userIds: string[]) => void;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

interface PresenceProviderProps {
  children: ReactNode;
  workspaceId: string;
  /** Optional list of user IDs to fetch initial presence for */
  initialUserIds?: string[];
}

/**
 * Provider for real-time presence state across the app.
 * Subscribes to presence:update events and manages presence state.
 */
export function PresenceProvider({
  children,
  workspaceId,
  initialUserIds = [],
}: PresenceProviderProps) {
  const socket = useSocket();
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceStatus>>({});

  // Join workspace room and set up presence on mount
  useEffect(() => {
    if (!socket.connected) return;

    // Join workspace room to receive presence broadcasts
    socket.emit("workspace:join", { workspaceId });

    // Fetch initial presence for provided users
    if (initialUserIds.length > 0) {
      socket.emit(
        "presence:fetch",
        { workspaceId, userIds: initialUserIds },
        (response) => {
          setPresenceMap((prev) => ({ ...prev, ...response }));
        }
      );
    }
  }, [socket, socket.connected, workspaceId, initialUserIds]);

  // Subscribe to presence updates
  useEffect(() => {
    const handlePresenceUpdate = (data: { userId: string; status: PresenceStatus }) => {
      setPresenceMap((prev) => ({
        ...prev,
        [data.userId]: data.status,
      }));
    };

    socket.on("presence:update", handlePresenceUpdate);

    return () => {
      socket.off("presence:update", handlePresenceUpdate);
    };
  }, [socket]);

  // Handle visibility change for away detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        socket.emit("presence:setAway");
      } else {
        socket.emit("presence:setActive");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [socket]);

  // Get a user's presence status
  const getPresence = useCallback(
    (userId: string): PresenceStatus => {
      return presenceMap[userId] || "offline";
    },
    [presenceMap]
  );

  // Refresh presence for a list of users
  const refreshPresence = useCallback(
    (userIds: string[]) => {
      if (userIds.length === 0) return;

      socket.emit(
        "presence:fetch",
        { workspaceId, userIds },
        (response) => {
          setPresenceMap((prev) => ({ ...prev, ...response }));
        }
      );
    },
    [socket, workspaceId]
  );

  return (
    <PresenceContext.Provider value={{ presenceMap, getPresence, refreshPresence }}>
      {children}
    </PresenceContext.Provider>
  );
}

/**
 * Hook to access presence state and utilities.
 * Must be used within a PresenceProvider.
 */
export function usePresence(): PresenceContextValue {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return context;
}

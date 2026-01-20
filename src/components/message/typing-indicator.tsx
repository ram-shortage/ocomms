"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/lib/socket-client";

interface TypingUser {
  userId: string;
  userName: string;
}

interface TypingIndicatorProps {
  /** Channel ID or conversation ID to watch for typing events */
  targetId: string;
}

/**
 * Displays "[Name] is typing..." indicator below message input.
 * Listens to socket typing:update events and displays active typers.
 *
 * Display format (per CONTEXT.md):
 * - 1 user: "Alice is typing..."
 * - 2 users: "Alice, Bob are typing..."
 * - 3+ users: "Alice, Bob, and N others are typing..."
 *
 * Reserved height (h-5) prevents layout shift.
 */
export function TypingIndicator({ targetId }: TypingIndicatorProps) {
  const socket = useSocket();
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());

  useEffect(() => {
    const handleTypingUpdate = (data: {
      userId: string;
      userName: string;
      targetId: string;
      isTyping: boolean;
    }) => {
      // Only process events for this target
      if (data.targetId !== targetId) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (data.isTyping) {
          next.set(data.userId, { userId: data.userId, userName: data.userName });
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    };

    socket.on("typing:update", handleTypingUpdate);
    return () => {
      socket.off("typing:update", handleTypingUpdate);
    };
  }, [socket, targetId]);

  // Clear typing users when target changes
  useEffect(() => {
    setTypingUsers(new Map());
  }, [targetId]);

  const users = Array.from(typingUsers.values());

  // Reserved space - always render h-5 to prevent layout shift
  if (users.length === 0) {
    return <div className="h-5" />;
  }

  // Format display text
  let text: string;
  if (users.length === 1) {
    text = `${users[0].userName} is typing...`;
  } else if (users.length === 2) {
    text = `${users[0].userName}, ${users[1].userName} are typing...`;
  } else {
    const others = users.length - 2;
    text = `${users[0].userName}, ${users[1].userName}, and ${others} ${others === 1 ? "other" : "others"} are typing...`;
  }

  return (
    <div className="h-5 text-xs text-muted-foreground px-1">
      {text}
    </div>
  );
}

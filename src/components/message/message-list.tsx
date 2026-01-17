"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/lib/socket-client";
import { MessageItem } from "./message-item";
import type { Message } from "@/lib/socket-events";

interface MessageListProps {
  initialMessages: Message[];
  targetId: string;
  targetType: "channel" | "dm";
  currentUserId: string;
}

export function MessageList({
  initialMessages,
  targetId,
  targetType,
  currentUserId,
}: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Subscribe to real-time message events
  useEffect(() => {
    function handleNewMessage(message: Message) {
      // Check if this message belongs to our target
      const belongsToTarget =
        (targetType === "channel" && message.channelId === targetId) ||
        (targetType === "dm" && message.conversationId === targetId);

      if (belongsToTarget) {
        setMessages((prev) => [...prev, message]);
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
    }

    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleDeletedMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleDeletedMessage);
    };
  }, [socket, targetId, targetType]);

  const handleDelete = useCallback(
    (messageId: string) => {
      socket.emit("message:delete", { messageId });
    },
    [socket]
  );

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>No messages yet. Be the first to say something!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-4">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          currentUserId={currentUserId}
          onDelete={handleDelete}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

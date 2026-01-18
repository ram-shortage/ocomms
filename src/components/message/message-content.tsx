"use client";

import { highlightMentions } from "@/lib/mentions";

interface MessageContentProps {
  content: string;
  currentUsername?: string;
}

/**
 * Message content component that renders text with highlighted mentions.
 * - User mentions: blue text with light blue background
 * - Current user's mentions: bold blue
 * - @channel/@here: orange text with amber background
 */
export function MessageContent({ content, currentUsername }: MessageContentProps) {
  const nodes = highlightMentions(content, currentUsername);

  return (
    <p className="text-gray-700 whitespace-pre-wrap break-words">{nodes}</p>
  );
}

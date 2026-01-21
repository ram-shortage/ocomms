"use client";

import type { ReactNode } from "react";
import { highlightMentionsWithGroups } from "@/lib/mentions";

// Custom emoji regex pattern
const CUSTOM_EMOJI_REGEX = /:([a-zA-Z0-9_-]+):/g;

interface CustomEmojiData {
  name: string;
  path: string;
}

interface GroupHandle {
  handle: string;
}

interface MessageContentProps {
  content: string;
  currentUsername?: string;
  customEmojis?: CustomEmojiData[]; // Map of name -> path
  groupHandles?: GroupHandle[]; // Known group handles for popup
  organizationId?: string; // For group popup lookups
}

/**
 * Message content component that renders text with highlighted mentions
 * and custom emoji.
 * - User mentions: blue text with light blue background
 * - Current user's mentions: bold blue
 * - @channel/@here: orange text with amber background
 * - Custom emoji: :name: syntax rendered as inline images
 */
export function MessageContent({
  content,
  currentUsername,
  customEmojis = [],
  groupHandles = [],
  organizationId,
}: MessageContentProps) {
  // Build emoji lookup map
  const emojiMap = new Map(customEmojis.map((e) => [e.name, e.path]));

  // Build group handle set for quick lookup
  const groupHandleSet = new Set(groupHandles.map((g) => g.handle.toLowerCase()));

  // Two-pass rendering:
  // 1. Replace :emoji: patterns with images, leaving text segments
  // 2. Apply mention highlighting to each text segment

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let segmentIndex = 0;

  // Reset regex state
  CUSTOM_EMOJI_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CUSTOM_EMOJI_REGEX.exec(content)) !== null) {
    const [fullMatch, name] = match;
    const path = emojiMap.get(name);

    // Add text before this match (with mention highlighting)
    if (match.index > lastIndex) {
      const textSegment = content.slice(lastIndex, match.index);
      const mentionNodes = highlightMentionsWithGroups(
        textSegment,
        currentUsername,
        groupHandleSet,
        organizationId
      );
      // Wrap in a span to provide key for the segment
      nodes.push(
        <span key={`seg-${segmentIndex}`}>{mentionNodes}</span>
      );
      segmentIndex++;
    }

    if (path) {
      // Render custom emoji as inline image
      nodes.push(
        <img
          key={`emoji-${match.index}`}
          src={path}
          alt={`:${name}:`}
          title={`:${name}:`}
          className="inline-block h-5 w-5 align-text-bottom"
        />
      );
    } else {
      // Not a known custom emoji, keep as text
      nodes.push(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text (with mention highlighting)
  if (lastIndex < content.length) {
    const textSegment = content.slice(lastIndex);
    const mentionNodes = highlightMentionsWithGroups(
      textSegment,
      currentUsername,
      groupHandleSet,
      organizationId
    );
    nodes.push(
      <span key={`seg-final`}>{mentionNodes}</span>
    );
  }

  // If no emoji were found, just use mention highlighting directly
  if (nodes.length === 0) {
    const mentionNodes = highlightMentionsWithGroups(
      content,
      currentUsername,
      groupHandleSet,
      organizationId
    );
    return (
      <p className="text-foreground whitespace-pre-wrap break-words">
        {mentionNodes}
      </p>
    );
  }

  return (
    <p className="text-foreground whitespace-pre-wrap break-words">{nodes}</p>
  );
}

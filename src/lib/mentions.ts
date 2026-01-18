/**
 * Mention parsing and extraction utilities.
 * Supports @username, @"Display Name", @channel, and @here mentions.
 */

import type { ReactNode } from "react";
import { createElement } from "react";

export interface ParsedMention {
  type: "user" | "channel" | "here";
  value: string; // username for user, "channel" or "here" for special
  start: number; // position in string
  end: number; // position in string
  raw: string; // original text matched (e.g., @john or @"John Doe")
}

/**
 * Regex pattern to match mentions:
 * - @username (alphanumeric, dots, underscores, hyphens)
 * - @"Display Name" (quoted for names with spaces)
 * - @channel (special - all members)
 * - @here (special - active members)
 */
export const MENTION_REGEX = /@(?:("([^"]+)")|([a-zA-Z0-9._-]+))/g;

/**
 * Parse mentions from message content.
 * Returns array of ParsedMention objects with type, value, and positions.
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const regex = new RegExp(MENTION_REGEX.source, "g");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const raw = match[0];
    // match[2] is quoted name content, match[3] is unquoted username
    const value = match[2] ?? match[3];
    const lowerValue = value.toLowerCase();

    let type: "user" | "channel" | "here";
    if (lowerValue === "channel") {
      type = "channel";
    } else if (lowerValue === "here") {
      type = "here";
    } else {
      type = "user";
    }

    mentions.push({
      type,
      value,
      start: match.index,
      end: match.index + raw.length,
      raw,
    });
  }

  return mentions;
}

/**
 * Extract just the usernames from mentions (excludes @channel and @here).
 */
export function extractMentionedUsernames(content: string): string[] {
  const mentions = parseMentions(content);
  return mentions
    .filter((m) => m.type === "user")
    .map((m) => m.value);
}

/**
 * Props for highlighted mention spans.
 */
interface MentionSpanProps {
  type: "user" | "channel" | "here";
  isSelf: boolean;
  children: string;
}

/**
 * Create a styled mention span element.
 */
function MentionSpan({ type, isSelf, children }: MentionSpanProps): ReactNode {
  let className = "rounded px-0.5 ";

  if (type === "channel" || type === "here") {
    className += "text-amber-600 bg-amber-50";
  } else {
    className += "text-blue-600 bg-blue-50";
    if (isSelf) {
      className += " font-semibold";
    }
  }

  return createElement("span", { className }, children);
}

/**
 * Highlight mentions in content, returning React nodes.
 * User mentions are blue, @channel/@here are orange.
 * Current user's mention is bold.
 */
export function highlightMentions(
  content: string,
  currentUsername?: string
): ReactNode[] {
  const mentions = parseMentions(content);

  if (mentions.length === 0) {
    return [content];
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  mentions.forEach((mention, index) => {
    // Add text before this mention
    if (mention.start > lastIndex) {
      nodes.push(content.slice(lastIndex, mention.start));
    }

    // Check if this mention is for the current user
    const isSelf =
      mention.type === "user" &&
      currentUsername !== undefined &&
      mention.value.toLowerCase() === currentUsername.toLowerCase();

    // Add the highlighted mention
    nodes.push(
      createElement(
        MentionSpan,
        { type: mention.type, isSelf, children: mention.raw, key: `mention-${index}` }
      )
    );

    lastIndex = mention.end;
  });

  // Add remaining text after last mention
  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return nodes;
}

/**
 * Format a username for insertion into message.
 * Wraps in quotes if contains spaces.
 */
export function formatMentionForInsert(name: string): string {
  if (name.includes(" ")) {
    return `@"${name}"`;
  }
  return `@${name}`;
}

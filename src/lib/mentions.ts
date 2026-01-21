/**
 * Mention parsing and extraction utilities.
 * Supports @username, @"Display Name", @channel, @here, and @group mentions.
 */

import type { ReactNode } from "react";
import { createElement } from "react";
import { GroupMentionPopup } from "@/components/user-group/group-mention-popup";

export interface ParsedMention {
  type: "user" | "channel" | "here" | "group";
  value: string; // username for user/group, "channel" or "here" for special
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
 * Extract just the usernames from mentions (excludes @channel, @here, and @group).
 */
export function extractMentionedUsernames(content: string): string[] {
  const mentions = parseMentions(content);
  return mentions
    .filter((m) => m.type === "user")
    .map((m) => m.value);
}

/**
 * Extract potential group handles from mentions.
 * Since groups and users use the same @handle syntax, this returns all
 * "user" type mentions as potential group handles.
 * The caller must check against the database to determine if a handle is a group.
 */
export function extractPotentialGroupHandles(content: string): string[] {
  const mentions = parseMentions(content);
  return mentions
    .filter((m) => m.type === "user")
    .map((m) => m.value);
}

/**
 * Props for highlighted mention spans.
 */
interface MentionSpanProps {
  type: "user" | "channel" | "here" | "group";
  isSelf: boolean;
  children: string;
}

/**
 * Create a styled mention span element.
 * - User mentions: blue background
 * - @channel/@here: orange/amber background
 * - Group mentions: purple background
 */
function MentionSpan({ type, isSelf, children }: MentionSpanProps): ReactNode {
  let className = "rounded px-0.5 ";

  if (type === "channel" || type === "here") {
    className += "text-amber-600 bg-amber-50";
  } else if (type === "group") {
    className += "text-purple-600 bg-purple-50";
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

/**
 * Enhanced mention span that wraps group mentions with popup.
 */
interface GroupMentionSpanProps {
  handle: string;
  organizationId: string;
  children: string;
}

function GroupMentionSpan({ handle, organizationId, children }: GroupMentionSpanProps): ReactNode {
  const innerSpan = createElement(
    "span",
    { className: "rounded px-0.5 text-purple-600 bg-purple-50 cursor-pointer hover:bg-purple-100" },
    children
  );
  return createElement(
    GroupMentionPopup,
    { handle, organizationId, children: innerSpan }
  );
}

/**
 * Highlight mentions in content with group popup support.
 * Group mentions (identified by groupHandleSet) get wrapped in popup trigger.
 * User mentions are blue, @channel/@here are orange, groups are purple with popup.
 * Current user's mention is bold.
 */
export function highlightMentionsWithGroups(
  content: string,
  currentUsername?: string,
  groupHandleSet?: Set<string>,
  organizationId?: string
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

    // Check if this mention is a known group
    const isGroup =
      mention.type === "user" &&
      groupHandleSet &&
      groupHandleSet.has(mention.value.toLowerCase());

    // Check if this mention is for the current user
    const isSelf =
      mention.type === "user" &&
      !isGroup &&
      currentUsername !== undefined &&
      mention.value.toLowerCase() === currentUsername.toLowerCase();

    if (isGroup && organizationId) {
      // Render group mention with popup
      nodes.push(
        createElement(
          GroupMentionSpan,
          {
            handle: mention.value,
            organizationId,
            children: mention.raw,
            key: `mention-${index}`,
          }
        )
      );
    } else {
      // Render regular mention
      nodes.push(
        createElement(
          MentionSpan,
          { type: isGroup ? "group" : mention.type, isSelf, children: mention.raw, key: `mention-${index}` }
        )
      );
    }

    lastIndex = mention.end;
  });

  // Add remaining text after last mention
  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return nodes;
}

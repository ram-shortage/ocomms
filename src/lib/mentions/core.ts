/**
 * Core mention parsing utilities.
 * No React/Next.js dependencies - safe to use in server-side code.
 */

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
 * Format a username for insertion into message.
 * Wraps in quotes if contains spaces.
 */
export function formatMentionForInsert(name: string): string {
  if (name.includes(" ")) {
    return `@"${name}"`;
  }
  return `@${name}`;
}

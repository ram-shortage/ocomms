/**
 * Mention module - re-exports core parsing utilities and provides React rendering functions.
 *
 * For server-side code (socket handlers), import directly from '@/lib/mentions/core'
 * to avoid pulling in React/Next.js dependencies.
 */

// Re-export everything from core for backward compatibility
export {
  type ParsedMention,
  MENTION_REGEX,
  parseMentions,
  extractMentionedUsernames,
  extractPotentialGroupHandles,
  formatMentionForInsert,
} from "./core";

// React rendering functions (client-side only)
export {
  highlightMentions,
  highlightMentionsWithGroups,
} from "./render";

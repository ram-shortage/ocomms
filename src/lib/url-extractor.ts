/**
 * URL extraction utility for link preview processing.
 * LINK-02: Extract up to 5 URLs from message content.
 */

// URL regex pattern matching http:// and https:// URLs
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

/**
 * Extract URLs from message content.
 * @param content - The message content to extract URLs from
 * @returns Array of unique URLs, limited to 5 (LINK-02)
 */
export function extractUrls(content: string): string[] {
  const matches = content.match(URL_REGEX);
  if (!matches) return [];

  // Dedupe and limit to 5 (LINK-02)
  return Array.from(new Set(matches)).slice(0, 5);
}

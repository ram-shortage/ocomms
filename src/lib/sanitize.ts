/**
 * Content sanitization library for security-sensitive text handling.
 *
 * SEC2-05: Sanitizes Unicode control characters (visual spoofing prevention)
 * and HTML content (XSS prevention for channel notes).
 *
 * Unicode sanitization replaces dangerous characters with a visible placeholder (U+25A1 = □)
 * to indicate that something was removed, without breaking legitimate content.
 *
 * HTML sanitization uses DOMPurify with a strict allowlist of safe tags and attributes.
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Dangerous Unicode control character patterns.
 *
 * C0 controls (U+0000-U+001F) excluding safe characters:
 * - Preserved: Tab (U+0009), Newline (U+000A), Carriage Return (U+000D)
 * - Replaced: All others including NULL, backspace, form feed, etc.
 *
 * C1 controls (U+0080-U+009F): Legacy terminal control sequences.
 * DEL character (U+007F): Delete control character.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F]/g;

/**
 * Dangerous zero-width characters.
 *
 * - ZWSP (U+200B): Zero-width space - used for hidden messages
 * - ZWNJ (U+200C): Zero-width non-joiner - used for hidden messages
 *
 * NOTE: ZWJ (U+200D) is intentionally NOT included here.
 * ZWJ is required for emoji sequences like family emoji (👨‍👩‍👧‍👦)
 * and professional emoji (👨‍💻). Removing it would break legitimate emoji.
 */
const ZERO_WIDTH_DANGEROUS = /[\u200B\u200C]/g;

/**
 * RTL override character (U+202E).
 * Used to spoof file extensions and URLs by reversing text direction.
 * Example attack: "important_exe.txt" displayed as "important_txt.exe"
 */
const RTL_OVERRIDE = /[\u202E]/g;

/**
 * Visible placeholder character for sanitized content.
 * Using WHITE SQUARE (□ U+25A1) to indicate something was there.
 */
const PLACEHOLDER = '\u25A1';

/**
 * Sanitize Unicode control characters from text.
 *
 * Replaces dangerous control characters with a visible placeholder (□).
 * Preserves legitimate content including:
 * - Tabs, newlines, carriage returns (formatting)
 * - ZWJ for emoji sequences (family, professional emoji)
 * - All standard printable Unicode
 *
 * @param text - The text to sanitize
 * @returns Sanitized text with dangerous characters replaced by □
 *
 * @example
 * sanitizeUnicode("Hello\u0000World") // "Hello□World"
 * sanitizeUnicode("Hello\u202Eevil") // "Hello□evil"
 * sanitizeUnicode("👨‍💻") // "👨‍💻" (preserved - uses ZWJ)
 */
export function sanitizeUnicode(text: string): string {
  return text
    .replace(CONTROL_CHARS, PLACEHOLDER)
    .replace(ZERO_WIDTH_DANGEROUS, PLACEHOLDER)
    .replace(RTL_OVERRIDE, PLACEHOLDER);
}

/**
 * Allowed HTML tags for channel notes.
 * Limited to basic formatting tags that cannot execute scripts.
 */
const ALLOWED_TAGS = ['b', 'i', 'strong', 'em', 'a', 'p', 'ul', 'ol', 'li', 'br'];

/**
 * Allowed HTML attributes.
 * Only href and title on links - no onclick, onerror, etc.
 */
const ALLOWED_ATTR = ['href', 'title'];

/**
 * Sanitize HTML content for channel notes.
 *
 * Allows a safe subset of HTML tags for basic formatting while
 * removing all potentially dangerous content including:
 * - Script tags and JavaScript execution
 * - Style tags and inline styles
 * - Event handlers (onclick, onerror, etc.)
 * - Data attributes
 * - Unknown protocols (javascript:, data:, etc.)
 *
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML with only safe tags preserved
 *
 * @example
 * sanitizeHtml("<b>Hello</b><script>alert('xss')</script>") // "<b>Hello</b>"
 * sanitizeHtml("<a href='javascript:alert(1)'>click</a>") // "<a>click</a>"
 * sanitizeHtml("<p onclick='evil()'>text</p>") // "<p>text</p>"
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

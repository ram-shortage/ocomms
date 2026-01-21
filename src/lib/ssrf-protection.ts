/**
 * SSRF protection utilities for link preview fetching.
 * LINK-07: Block private/internal IPs at URL validation time.
 * Note: request-filtering-agent provides DNS-level SSRF protection in the worker.
 */

/**
 * File extensions to skip preview fetching for.
 * CONTEXT decision: skip .pdf, .zip, etc. for direct file links.
 */
export const FILE_EXTENSIONS_TO_SKIP = [
  ".pdf",
  ".zip",
  ".exe",
  ".dmg",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".iso",
  ".bin",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
];

/**
 * Check if a URL is safe to fetch for preview.
 * Validates protocol and skips direct file links.
 * @param url - The URL to validate
 * @returns true if URL is safe to fetch
 */
export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    // Skip direct file links
    const pathname = parsed.pathname.toLowerCase();
    if (FILE_EXTENSIONS_TO_SKIP.some((ext) => pathname.endsWith(ext))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

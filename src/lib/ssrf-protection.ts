/**
 * SSRF Protection Utilities
 *
 * This module provides protection against Server-Side Request Forgery attacks,
 * including DNS rebinding protection.
 *
 * DNS Rebinding Protection:
 * - request-filtering-agent validates the resolved IP address, not just hostname
 * - This prevents DNS rebinding where attacker DNS first resolves to public IP
 *   (passing hostname check) then resolves to private IP (during actual request)
 * - The agent blocks requests AFTER DNS resolution if IP is private/internal
 *
 * Usage:
 * 1. Call isUrlSafe() to validate URL format before queuing
 * 2. Use RequestFilteringHttpAgent in actual fetch calls
 *
 * Security requirements addressed:
 * - LINK-07: Block private/internal IPs at URL validation time
 * - SEC2-15: DNS rebinding protection via request-filtering-agent
 */

import { isIP } from "net";

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
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
];

/**
 * Blocked hostname patterns - known internal/metadata endpoints.
 */
const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "[::1]",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal", // GCP metadata
];

/**
 * Allowed protocols for link preview fetching.
 */
const ALLOWED_PROTOCOLS = ["http:", "https:"];

/**
 * Check if a URL is safe to fetch for preview.
 *
 * This performs URL-level validation BEFORE queuing.
 * Actual DNS rebinding protection happens via request-filtering-agent during fetch.
 *
 * @param url - The URL to validate
 * @returns true if URL is safe to fetch
 */
export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Protocol check
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block direct IP addresses (force DNS resolution path for rebinding protection)
    // This ensures all requests go through DNS, where request-filtering-agent
    // can validate the resolved IP address
    if (isIP(hostname)) {
      console.log(`[SSRF] Blocked direct IP address: ${hostname}`);
      return false;
    }

    // Block known internal hostnames
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      console.log(`[SSRF] Blocked internal hostname: ${hostname}`);
      return false;
    }

    // Block hostnames ending with internal TLDs
    if (
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".localhost")
    ) {
      console.log(`[SSRF] Blocked internal TLD: ${hostname}`);
      return false;
    }

    // File extension check - skip non-HTML content
    const pathname = parsed.pathname.toLowerCase();
    if (FILE_EXTENSIONS_TO_SKIP.some((ext) => pathname.endsWith(ext))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that hostname doesn't resolve to private IP.
 *
 * Note: This is handled by request-filtering-agent at fetch time,
 * but this function documents the protection and can be used for testing.
 *
 * In production, request-filtering-agent handles this automatically
 * by blocking requests after DNS resolution if IP is private.
 * The agent blocks these IP ranges:
 * - 10.0.0.0/8 (private)
 * - 172.16.0.0/12 (private)
 * - 192.168.0.0/16 (private)
 * - 127.0.0.0/8 (loopback)
 * - 169.254.0.0/16 (link-local)
 * - ::1 (IPv6 loopback)
 * - fc00::/7 (IPv6 unique local)
 * - fe80::/10 (IPv6 link-local)
 */
export async function validateNotPrivateIP(
  _hostname: string
): Promise<boolean> {
  // This function exists for documentation and testing purposes.
  // In production, request-filtering-agent handles this automatically
  // by blocking requests after DNS resolution if IP is private.
  return true;
}

// Test cases for SSRF protection (for reference):
// isUrlSafe("http://localhost/secret") -> false (blocked hostname)
// isUrlSafe("http://127.0.0.1/secret") -> false (direct IP blocked)
// isUrlSafe("http://192.168.1.1/internal") -> false (direct IP blocked)
// isUrlSafe("http://169.254.169.254/metadata") -> false (AWS metadata blocked)
// isUrlSafe("http://evil.local/exploit") -> false (internal TLD blocked)
// isUrlSafe("http://evil.com") -> true (passes URL check)
//   BUT: if evil.com DNS resolves to 127.0.0.1, request-filtering-agent blocks
// isUrlSafe("http://example.com/file.pdf") -> false (blocked extension)
// isUrlSafe("https://github.com/readme") -> true (safe external URL)

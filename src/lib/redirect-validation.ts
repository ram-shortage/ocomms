/**
 * Redirect URL validation to prevent open redirect vulnerabilities.
 *
 * Validates that redirect URLs point to allowed domains only.
 * Domains are configured via ALLOWED_REDIRECT_DOMAINS env var
 * or default to NEXT_PUBLIC_APP_URL domain.
 */

let allowedDomains: string[] = [];
let initialized = false;

/**
 * Initialize allowed redirect domains from environment.
 * Call once at startup (in server.ts or middleware).
 */
export function initAllowedRedirectDomains(): void {
  const envDomains = process.env.ALLOWED_REDIRECT_DOMAINS;

  if (envDomains) {
    allowedDomains = envDomains
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  } else if (process.env.NEXT_PUBLIC_APP_URL) {
    // Extract domain from APP_URL
    try {
      const url = new URL(process.env.NEXT_PUBLIC_APP_URL);
      allowedDomains = [url.hostname];
    } catch {
      console.error(
        "[Redirect] Invalid NEXT_PUBLIC_APP_URL, no redirect domains configured"
      );
      allowedDomains = [];
    }
  }

  if (allowedDomains.length === 0) {
    console.warn(
      "[Redirect] No allowed redirect domains configured - all external redirects will be blocked"
    );
  } else {
    console.log(
      `[Redirect] Allowed redirect domains: ${allowedDomains.join(", ")}`
    );
  }

  initialized = true;
}

/**
 * Validate a redirect URL against allowed domains.
 *
 * @param url - The URL to validate
 * @returns true if URL is safe to redirect to
 */
export function validateRedirectUrl(url: string): boolean {
  if (!initialized) {
    initAllowedRedirectDomains();
  }

  // Allow relative URLs (same origin)
  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  // Parse absolute URL
  try {
    const parsed = new URL(url);

    // Only allow http(s)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    // Check hostname against allowed domains
    const hostname = parsed.hostname.toLowerCase();

    // Exact match
    if (allowedDomains.includes(hostname)) {
      return true;
    }

    // Subdomain match (if domain starts with .)
    for (const domain of allowedDomains) {
      if (domain.startsWith(".") && hostname.endsWith(domain)) {
        return true;
      }
    }

    return false;
  } catch {
    // Invalid URL
    return false;
  }
}

/**
 * Get safe redirect URL or fallback.
 *
 * @param url - The requested redirect URL
 * @param fallback - Fallback URL if invalid (default: "/")
 * @returns Safe URL to redirect to
 */
export function getSafeRedirectUrl(
  url: string | null | undefined,
  fallback = "/"
): string {
  if (!url) {
    return fallback;
  }

  if (validateRedirectUrl(url)) {
    return url;
  }

  console.warn(`[Redirect] Blocked invalid redirect URL: ${url}`);
  return fallback;
}

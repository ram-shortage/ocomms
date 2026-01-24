import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, generateCSP } from "@/lib/security/csp";
import { validateSession } from "@/lib/security/session-store";

// Session validation timeout and retry configuration
const SESSION_FETCH_TIMEOUT_MS = 5000; // 5 seconds
const SESSION_FETCH_RETRIES = 1; // Retry once on failure

/**
 * Fetch with timeout support.
 * Returns the response or throws on timeout/error.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with timeout and retry logic.
 * Returns Response on success, null on network failure (timeout, connection error).
 * This allows callers to distinguish between network failures and HTTP errors.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  { timeout = 5000, retries = 1 }: { timeout?: number; retries?: number } = {}
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeout);
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorType = error instanceof Error && error.name === "AbortError" ? "timeout" : "network";

      if (isLastAttempt) {
        console.error(
          `[Middleware] Session fetch ${errorType} after ${retries + 1} attempts`
        );
        return null; // Return null to indicate network failure (not auth failure)
      }

      // Wait 100ms before retry
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return null;
}

// Public routes that don't require authentication
const publicRoutes = ["/login", "/signup", "/verify-email", "/api/auth", "/api/health", "/socket.io", "/accept-invite", "/api/csp-report", "/api/push/vapid-public"];

// Static assets and other paths to skip
const skipPaths = ["/_next", "/favicon.ico", "/uploads"];

const isDev = process.env.NODE_ENV !== "production";

/**
 * Add security headers to API responses.
 * These supplement nginx headers, ensuring they're set even for direct API access.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Cache control for API routes - prevent caching of sensitive data
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate CSP nonce for this request
  const nonce = generateNonce();
  const csp = generateCSP(nonce, isDev);
  const isApiRoute = pathname.startsWith("/api/");

  // Log API requests in development, sample 10% in production
  if (isApiRoute) {
    const shouldLog = isDev || Math.random() < 0.1;
    if (shouldLog) {
      // Edge runtime compatible logging (can't use Pino here)
      console.log(JSON.stringify({
        level: "info",
        module: "middleware",
        method: request.method,
        path: pathname,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  // Skip static assets
  if (skipPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    let response = NextResponse.next();
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('x-nonce', nonce);
    // Add security headers to public API routes
    if (isApiRoute) {
      response = addSecurityHeaders(response);
    }
    return response;
  }

  // Check for session cookie (may have __Secure- prefix in production)
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validate session with better-auth API
  // Uses timeout + retry to handle transient network issues gracefully
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const sessionUrl = `${baseUrl}/api/auth/get-session`;

  const sessionResponse = await fetchWithRetry(
    sessionUrl,
    { headers: { cookie: request.headers.get("cookie") || "" } },
    { timeout: SESSION_FETCH_TIMEOUT_MS, retries: SESSION_FETCH_RETRIES }
  );

  // Helper to create authenticated response (used in multiple paths)
  const createAuthenticatedResponse = () => {
    let response = NextResponse.next();
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("x-nonce", nonce);
    if (isApiRoute) {
      response = addSecurityHeaders(response);
    }
    return response;
  };

  // Network failure (timeout, connection error) - allow through with cookie validation only
  // SECFIX-02 note: We already verified the cookie exists (line 135), so we have some
  // evidence of a valid session. Logging out on transient network issues is too aggressive.
  if (sessionResponse === null) {
    console.warn(
      "[Middleware] Session validation unavailable (network) - allowing with cookie validation only"
    );
    return createAuthenticatedResponse();
  }

  // Confirmed auth failure (401, 403) - session is definitely invalid
  if (sessionResponse.status === 401 || sessionResponse.status === 403) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("better-auth.session_token");
    return response;
  }

  // Server error (5xx) - transient issue, allow through with cookie validation
  if (sessionResponse.status >= 500) {
    console.warn(
      `[Middleware] Session endpoint returned ${sessionResponse.status} - allowing with cookie validation`
    );
    return createAuthenticatedResponse();
  }

  // Other non-OK status - unexpected, log and allow through to avoid false logouts
  if (!sessionResponse.ok) {
    console.warn(
      `[Middleware] Unexpected session status ${sessionResponse.status} - allowing with cookie validation`
    );
    return createAuthenticatedResponse();
  }

  // Parse session response
  let session;
  try {
    session = await sessionResponse.json();
  } catch {
    console.warn("[Middleware] Failed to parse session response - allowing with cookie validation");
    return createAuthenticatedResponse();
  }

  // No user in session - confirmed invalid, redirect to login
  if (!session?.user) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("better-auth.session_token");
    return response;
  }

  // Validate session against Redis for immediate revocation support
  // Redis errors should NOT cause logout - we already validated via better-auth
  if (session?.session?.id) {
    try {
      const isValid = await validateSession(session.session.id);
      if (!isValid) {
        // Session explicitly revoked in Redis - redirect to login
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("better-auth.session_token");
        return response;
      }
    } catch (redisError) {
      // Redis validation failed - log but allow through (we validated via better-auth)
      console.warn("[Middleware] Redis validation failed - proceeding with better-auth validation:", redisError);
    }
  }

  // Session fully validated - proceed with request
  return createAuthenticatedResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// Use Node.js runtime for ioredis compatibility
export const runtime = "nodejs";

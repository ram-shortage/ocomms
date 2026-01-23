import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, generateCSP } from "@/lib/security/csp";
import { validateSession } from "@/lib/security/session-store";

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

  // Validate session with better-auth API (no caching - Redis validation required)
  try {
    // Call the session endpoint to validate
    // Use the request URL for the fetch - Next.js middleware handles this correctly
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const sessionResponse = await fetch(`${baseUrl}/api/auth/get-session`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (!sessionResponse.ok) {
      // Session invalid - redirect to login
      const response = NextResponse.redirect(new URL("/login", request.url));
      // Clear the invalid cookie
      response.cookies.delete("better-auth.session_token");
      return response;
    }

    const session = await sessionResponse.json();
    if (!session?.user) {
      // No user in session - redirect to login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("better-auth.session_token");
      return response;
    }

    // Validate session against Redis for immediate revocation support
    if (session?.session?.id) {
      const isValid = await validateSession(session.session.id);
      if (!isValid) {
        // Session revoked - redirect to login
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.delete("better-auth.session_token");
        return response;
      }
    }

    // Session valid - proceed with request
    let response = NextResponse.next();
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('x-nonce', nonce);
    // Add security headers to authenticated API routes
    if (isApiRoute) {
      response = addSecurityHeaders(response);
    }
    return response;
  } catch (error) {
    console.error("[Middleware] Session validation error:", error);
    console.error("[Middleware] URL attempted:", `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/auth/get-session`);
    // SECFIX-02: Fail closed - redirect to login on any validation error
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("better-auth.session_token");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

// Use Node.js runtime for ioredis compatibility
export const runtime = "nodejs";

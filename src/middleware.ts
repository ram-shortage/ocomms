import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, generateCSP } from "@/lib/security/csp";
import { validateSession } from "@/lib/security/session-store";

// Public routes that don't require authentication
const publicRoutes = ["/login", "/signup", "/verify-email", "/api/auth", "/api/health", "/socket.io", "/accept-invite", "/api/csp-report"];

// Static assets and other paths to skip
const skipPaths = ["/_next", "/favicon.ico", "/uploads"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate CSP nonce for this request
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === 'development';
  const csp = generateCSP(nonce, isDev);

  // Skip static assets
  if (skipPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('x-nonce', nonce);
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
    const response = NextResponse.next();
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('x-nonce', nonce);
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

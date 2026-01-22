import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, generateCSP } from "@/lib/security/csp";

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

  // Skip full validation if we validated recently (within last 5 minutes)
  // This reduces latency for frequent requests while maintaining security
  const lastValidated = request.cookies.get("_session_validated");
  if (lastValidated) {
    const validatedAt = parseInt(lastValidated.value, 10);
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (validatedAt > fiveMinutesAgo) {
      // Recently validated, skip full check
      return NextResponse.next();
    }
  }

  // Validate session with better-auth API
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

    // Session valid - set validation timestamp and proceed
    const response = NextResponse.next();
    response.cookies.set("_session_validated", Date.now().toString(), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 300, // 5 minutes
    });
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

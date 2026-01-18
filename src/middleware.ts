import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const publicRoutes = ["/login", "/signup", "/verify-email", "/api/auth", "/api/health", "/socket.io", "/accept-invite"];

// Static assets and other paths to skip
const skipPaths = ["/_next", "/favicon.ico", "/uploads"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (skipPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get("better-auth.session_token");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validate session with better-auth API
  try {
    // Call the session endpoint to validate
    const sessionResponse = await fetch(new URL("/api/auth/get-session", request.url), {
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

    // Session valid - proceed
    return NextResponse.next();
  } catch (error) {
    console.error("[Middleware] Session validation error:", error);
    // On error, allow through (fail open for availability)
    // The downstream page will re-check anyway
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

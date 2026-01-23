import { NextResponse } from "next/server";
import { apiLogger } from "@/lib/logger";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Sanitize error messages for client response.
 * In development: show detailed errors for debugging
 * In production: show generic messages to prevent info leakage
 */
export function sanitizeError(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof Error) {
    // Log full error server-side
    apiLogger.error({ err: error }, "API error occurred");

    // Known safe errors that can be shown to users
    const safeErrors = [
      "Unauthorized",
      "Not found",
      "Not authorized",
      "Invalid request",
      "Validation failed",
      "Rate limit exceeded",
      "File too large",
      "Invalid file type",
      "Quota exceeded",
    ];

    const isSafeError = safeErrors.some((safe) =>
      error.message.toLowerCase().includes(safe.toLowerCase())
    );

    if (isDev || isSafeError) {
      return { message: error.message, status: 400 };
    }

    // Generic message for production
    return { message: "An error occurred", status: 500 };
  }

  return { message: "An unexpected error occurred", status: 500 };
}

/**
 * Create error response with proper headers.
 */
export function errorResponse(error: unknown): NextResponse {
  const { message, status } = sanitizeError(error);
  return NextResponse.json({ error: message }, { status });
}

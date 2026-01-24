/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Used for server-side initialization like configuring VAPID for push notifications.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { configureVapid } = await import("@/lib/push/vapid");
    configureVapid();
  }
}

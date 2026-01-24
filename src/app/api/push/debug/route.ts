import { NextResponse } from "next/server";
import { isVapidConfigured, getVapidPublicKey, configureVapid } from "@/lib/push";

/**
 * Debug endpoint for push notification configuration.
 * Returns diagnostic information about VAPID setup.
 */
export async function GET() {
  const hasPublicKey = !!process.env.VAPID_PUBLIC_KEY;
  const hasPrivateKey = !!process.env.VAPID_PRIVATE_KEY;
  const hasSubject = !!process.env.VAPID_SUBJECT;
  const hasNextPublicKey = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // Check current state
  const vapidConfiguredBefore = isVapidConfigured();

  // Try to configure now if not already configured
  let configureResult: string = "already configured";
  let configureError: string | null = null;
  if (!vapidConfiguredBefore) {
    try {
      const success = configureVapid();
      configureResult = success ? "configured successfully" : "returned false";
    } catch (err) {
      configureResult = "threw error";
      configureError = err instanceof Error ? err.message : String(err);
    }
  }

  const vapidConfiguredAfter = isVapidConfigured();
  const publicKeyFromGetter = getVapidPublicKey();

  return NextResponse.json({
    vapidConfiguredBefore,
    vapidConfiguredAfter,
    configureResult,
    configureError,
    environment: {
      VAPID_PUBLIC_KEY: hasPublicKey ? "set" : "missing",
      VAPID_PRIVATE_KEY: hasPrivateKey ? "set" : "missing",
      VAPID_SUBJECT: hasSubject ? "set" : "missing",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: hasNextPublicKey ? "set" : "missing",
      VAPID_SUBJECT_VALUE: process.env.VAPID_SUBJECT || "not set",
    },
    publicKeyAvailable: !!publicKeyFromGetter,
    publicKeyLength: publicKeyFromGetter?.length || 0,
  });
}

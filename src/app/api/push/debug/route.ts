import { NextResponse } from "next/server";
import { isVapidConfigured, getVapidPublicKey } from "@/lib/push";

/**
 * Debug endpoint for push notification configuration.
 * Returns diagnostic information about VAPID setup.
 */
export async function GET() {
  const hasPublicKey = !!process.env.VAPID_PUBLIC_KEY;
  const hasPrivateKey = !!process.env.VAPID_PRIVATE_KEY;
  const hasSubject = !!process.env.VAPID_SUBJECT;
  const hasNextPublicKey = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const vapidConfigured = isVapidConfigured();
  const publicKeyFromGetter = getVapidPublicKey();

  return NextResponse.json({
    vapidConfigured,
    environment: {
      VAPID_PUBLIC_KEY: hasPublicKey ? "set" : "missing",
      VAPID_PRIVATE_KEY: hasPrivateKey ? "set" : "missing",
      VAPID_SUBJECT: hasSubject ? "set" : "missing",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: hasNextPublicKey ? "set" : "missing",
    },
    publicKeyAvailable: !!publicKeyFromGetter,
    publicKeyLength: publicKeyFromGetter?.length || 0,
    diagnosis: !vapidConfigured
      ? "VAPID not configured - check environment variables and server logs"
      : !publicKeyFromGetter
        ? "VAPID configured but public key getter returns null"
        : "VAPID appears correctly configured",
  });
}

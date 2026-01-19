/**
 * VAPID (Voluntary Application Server Identification) key management for Web Push
 *
 * Generate keys with: npx web-push generate-vapid-keys
 * Store in environment variables (see .env.example)
 *
 * VAPID allows push services to identify your server without needing
 * proprietary API keys like Firebase or GCM.
 */
import webpush from "web-push";

let vapidConfigured = false;

/**
 * Configure VAPID details for web-push library.
 *
 * Reads VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT from environment.
 * Call this once at server startup.
 *
 * @returns true if VAPID is configured, false if keys are missing
 */
export function configureVapid(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    console.warn(
      "[Push] VAPID keys not configured - push notifications disabled. " +
      "Generate keys with: npx web-push generate-vapid-keys"
    );
    vapidConfigured = false;
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    console.log("[Push] VAPID configured successfully");
    return true;
  } catch (error) {
    console.error("[Push] Failed to configure VAPID:", error);
    vapidConfigured = false;
    return false;
  }
}

/**
 * Check if VAPID is currently configured.
 *
 * Use this to conditionally enable push features in the UI.
 */
export function isVapidConfigured(): boolean {
  return vapidConfigured;
}

/**
 * Get the public VAPID key for client-side push subscription.
 *
 * The client needs this key to create a PushSubscription.
 * Returns the NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable.
 *
 * @returns The public VAPID key, or null if not configured
 */
export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

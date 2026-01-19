/**
 * Push notification sending utility
 *
 * Sends push notifications to all of a user's subscribed devices.
 * Automatically cleans up expired/invalid subscriptions.
 */
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isVapidConfigured } from "./vapid";

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data: {
    url: string;
    tag: string;
    type: "dm" | "mention" | "channel" | "here";
    messageId?: string;
  };
}

/**
 * Send push notification to all of a user's subscribed devices.
 * Handles expired subscriptions by removing them automatically.
 *
 * @returns Object with sent count and failed count
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  // Check if push is configured
  if (!isVapidConfigured()) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  // Get all subscriptions for user
  const subscriptions = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, userId),
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;

  // Send to all devices
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 } // 24 hours
        );
        sent++;
      } catch (error: unknown) {
        const pushError = error as { statusCode?: number };

        // 410 Gone or 404 = subscription expired, remove it
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
          removed++;
          console.log(`[Push] Removed expired subscription ${sub.id} for user ${userId}`);
        } else {
          failed++;
          console.error(`[Push] Failed to send to ${sub.endpoint}:`, error);
        }
      }
    })
  );

  if (sent > 0) {
    console.log(`[Push] Sent ${sent} notification(s) to user ${userId}`);
  }

  return { sent, failed, removed };
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isVapidConfigured, configureVapid } from "@/lib/push";

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function POST(request: NextRequest) {
  // Ensure VAPID is configured (API routes run in separate process from custom server)
  if (!isVapidConfigured()) {
    configureVapid();
  }

  // Verify push is configured
  if (!isVapidConfigured()) {
    return NextResponse.json(
      { error: "Push notifications not configured" },
      { status: 503 }
    );
  }

  // Verify authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscription: PushSubscriptionJSON = await request.json();

    // Validate required fields
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: "Invalid subscription format" },
        { status: 400 }
      );
    }

    // Check if subscription already exists (same endpoint)
    const existing = await db.query.pushSubscriptions.findFirst({
      where: eq(pushSubscriptions.endpoint, subscription.endpoint),
    });

    if (existing) {
      // Update if same user, reject if different user
      if (existing.userId !== session.user.id) {
        // Endpoint registered to different user - remove old and add new
        await db.delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      } else {
        // Already registered to this user
        return NextResponse.json({ success: true, message: "Already subscribed" });
      }
    }

    // Get user agent for device identification
    const userAgent = request.headers.get("user-agent") || undefined;

    // Insert subscription
    await db.insert(pushSubscriptions).values({
      userId: session.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push Subscribe] Error:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}

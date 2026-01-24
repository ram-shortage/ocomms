import { NextResponse } from "next/server";
import { getVapidPublicKey, isVapidConfigured, configureVapid } from "@/lib/push";

export async function GET() {
  // Ensure VAPID is configured (API routes run in separate process from custom server)
  if (!isVapidConfigured()) {
    configureVapid();
  }

  if (!isVapidConfigured()) {
    return NextResponse.json(
      { error: "Push notifications not configured" },
      { status: 503 }
    );
  }

  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    return NextResponse.json(
      { error: "VAPID public key not available" },
      { status: 503 }
    );
  }

  return NextResponse.json({ publicKey });
}

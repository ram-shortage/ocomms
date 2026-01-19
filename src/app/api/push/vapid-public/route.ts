import { NextResponse } from "next/server";
import { getVapidPublicKey, isVapidConfigured } from "@/lib/push";

export async function GET() {
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

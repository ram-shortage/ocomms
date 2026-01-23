import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserStorage } from "@/lib/security/storage-quota";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storage = await getUserStorage(session.user.id);
  return NextResponse.json({
    usedBytes: storage.usedBytes,
    quotaBytes: storage.quotaBytes,
  });
}

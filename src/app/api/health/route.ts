import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Check database connectivity
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "unhealthy", error: (error as Error).message },
      { status: 503 }
    );
  }
}

import { NextResponse } from "next/server";
import { db, sql } from "@/db";

export async function GET() {
  try {
    // Check database connectivity with simple query
    await db.execute(sql`SELECT 1`);

    // Try to check SSL status (may not be available in all PostgreSQL configs)
    let sslEnabled: boolean | null = null;
    try {
      const result = await db.execute(sql`SELECT ssl_is_used() as ssl_enabled`);
      const row = result[0] as { ssl_enabled?: boolean } | undefined;
      sslEnabled = row?.ssl_enabled ?? false;
    } catch {
      // ssl_is_used() not available - SSL status unknown
      sslEnabled = null;
    }

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        ssl: sslEnabled,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: (error as Error).message,
        database: {
          connected: false,
          ssl: false,
        },
      },
      { status: 503 }
    );
  }
}

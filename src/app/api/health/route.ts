import { NextResponse } from "next/server";
import { db, sql } from "@/db";

export async function GET() {
  try {
    // Check database connectivity and SSL status
    const result = await db.execute(sql`SELECT ssl_is_used() as ssl_enabled`);
    const sslEnabled = result[0]?.ssl_enabled ?? false;

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

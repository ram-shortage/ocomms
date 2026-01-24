import { config } from "dotenv";
import { existsSync } from "node:fs";

// Load .env.local first (higher priority), then .env (like Next.js)
if (existsSync(".env.local")) {
  config({ path: ".env.local" });
}
config(); // loads .env, won't override existing values

import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { createRedisAdapter, createPresenceRedisClient } from "./socket/adapter";
import { setupSocketHandlers } from "./socket";
import { initAllowedRedirectDomains } from "@/lib/redirect-validation";
import { scheduleAttachmentCleanup } from "./queue/attachment-cleanup.queue";
import { configureVapid } from "@/lib/push/vapid";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";

// Initialize VAPID for push notifications
configureVapid();

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000");

// SECFIX-07: Warn if NEXT_PUBLIC_APP_URL not set in production
if (!dev && !process.env.NEXT_PUBLIC_APP_URL) {
  console.warn("[Server] NEXT_PUBLIC_APP_URL not set in production - using fallback origin");
}

/**
 * Socket.IO CORS Configuration (SEC2-13)
 *
 * Set ALLOWED_ORIGINS env var as comma-separated list of allowed origins:
 * ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
 *
 * Falls back to NEXT_PUBLIC_APP_URL if ALLOWED_ORIGINS not set.
 */
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  }
  // Fallback: use NEXT_PUBLIC_APP_URL or default
  return [process.env.NEXT_PUBLIC_APP_URL || `http://${hostname}:${port}`];
};

const allowedOrigins = getAllowedOrigins();

// Wrap in async IIFE to allow dynamic import of Next.js
// Next.js 16+ checks for shared AsyncLocalStorage at import time which fails in custom servers
(async () => {
  // Initialize redirect URL validation (SEC2-14)
  initAllowedRedirectDomains();

  const next = (await import("next")).default;
  const app = next({ dev, hostname, port });
  const handler = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer(handler);

  // Log allowed origins on startup
  console.log(`[Socket.IO] Allowed origins: ${allowedOrigins.join(", ")}`);

  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., same-origin, mobile apps, server-to-server)
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // Log CORS violation with origin details (SEC2-13)
          console.warn(`[Socket.IO] CORS violation: origin "${origin}" not in whitelist [${allowedOrigins.join(", ")}]`);
          callback(new Error("Origin not allowed"), false);
        }
      },
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
  });

  // Attach Redis adapter for scaling (optional - falls back to in-memory)
  const adapter = await createRedisAdapter();
  if (adapter) {
    io.adapter(adapter);
  }

  // Create Redis client for presence (separate from adapter)
  const presenceRedis = await createPresenceRedisClient();

  // Setup event handlers with Redis for presence
  setupSocketHandlers(io, presenceRedis);

  // Schedule attachment cleanup job (runs daily at 3 AM)
  try {
    await scheduleAttachmentCleanup();
  } catch (error) {
    // Non-fatal: cleanup scheduling failed (Redis may not be available)
    console.warn("[Server] Failed to schedule attachment cleanup:", error);
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO ready at /socket.io/`);
  });
})();

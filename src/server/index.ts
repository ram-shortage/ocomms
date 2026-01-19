import { config } from "dotenv";
import { existsSync } from "node:fs";

// Load .env.local first (higher priority), then .env (like Next.js)
if (existsSync(".env.local")) {
  config({ path: ".env.local" });
}
config(); // loads .env, won't override existing values
import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { createRedisAdapter, createPresenceRedisClient } from "./socket/adapter";
import { setupSocketHandlers } from "./socket";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000");

// SECFIX-07: Warn if NEXT_PUBLIC_APP_URL not set in production
if (!dev && !process.env.NEXT_PUBLIC_APP_URL) {
  console.warn("[Server] NEXT_PUBLIC_APP_URL not set in production - using fallback origin");
}

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(handler);

  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || `http://${hostname}:${port}`,
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

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO ready at /socket.io/`);
  });
});

import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { createRedisAdapter } from "./socket/adapter";
import { setupSocketHandlers } from "./socket";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000");

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

  // Setup event handlers
  setupSocketHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO ready at /socket.io/`);
  });
});

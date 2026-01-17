import { createAdapter } from "@socket.io/redis-adapter";
import { createRedisClient } from "../redis";

/**
 * Create Redis adapter for Socket.IO horizontal scaling.
 * Returns null if Redis connection fails (graceful fallback to in-memory adapter).
 */
export async function createRedisAdapter() {
  try {
    const pubClient = createRedisClient();
    const subClient = pubClient.duplicate();

    // Wait for both connections with timeout
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        pubClient.on("connect", () => resolve());
        pubClient.on("error", (err) => reject(err));
        setTimeout(() => reject(new Error("Redis pub client connection timeout")), 5000);
      }),
      new Promise<void>((resolve, reject) => {
        subClient.on("connect", () => resolve());
        subClient.on("error", (err) => reject(err));
        setTimeout(() => reject(new Error("Redis sub client connection timeout")), 5000);
      }),
    ]);

    console.log("[Socket.IO] Redis adapter connected");
    return createAdapter(pubClient, subClient);
  } catch (error) {
    console.warn("[Socket.IO] Redis not available, using in-memory adapter:", (error as Error).message);
    return null;
  }
}

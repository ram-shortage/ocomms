import type { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { createRedisClient as createRedis } from "../redis";

// Re-export for convenience
export { createRedis as createRedisClient };

/**
 * Create a Redis client for presence/general operations.
 * Returns null if Redis connection fails.
 */
export async function createPresenceRedisClient(): Promise<Redis | null> {
  try {
    const client = createRedis();

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => resolve());
      client.on("error", (err) => reject(err));
      setTimeout(() => reject(new Error("Redis connection timeout")), 5000);
    });

    console.log("[Redis] Presence client connected");
    return client;
  } catch (error) {
    console.warn("[Redis] Presence client not available:", (error as Error).message);
    return null;
  }
}

/**
 * Create Redis adapter for Socket.IO horizontal scaling.
 * Returns null if Redis connection fails (graceful fallback to in-memory adapter).
 */
export async function createRedisAdapter() {
  try {
    const pubClient = createRedis();
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

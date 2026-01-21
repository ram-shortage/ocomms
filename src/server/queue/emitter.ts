/**
 * Redis emitter for Socket.IO events from worker processes.
 * Uses @socket.io/redis-emitter to send events without the full Socket.IO server.
 */
import { Emitter } from "@socket.io/redis-emitter";
import Redis from "ioredis";
import type { ServerToClientEvents } from "@/lib/socket-events";

let emitter: Emitter<ServerToClientEvents> | null = null;

/**
 * Get or create the Redis emitter singleton.
 * Used by workers to emit Socket.IO events to connected clients.
 */
export function getEmitter(): Emitter<ServerToClientEvents> {
  if (!emitter) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    const redisClient = new Redis(redisUrl);
    emitter = new Emitter<ServerToClientEvents>(redisClient);
  }

  return emitter;
}

/**
 * Close the emitter connection.
 * Call during graceful shutdown.
 */
export async function closeEmitter(): Promise<void> {
  if (emitter) {
    // The emitter doesn't have a close method directly,
    // but we should close the underlying Redis client
    // Cast to access the internal redis property
    const internalEmitter = emitter as unknown as { redis: Redis };
    if (internalEmitter.redis) {
      await internalEmitter.redis.quit();
    }
    emitter = null;
  }
}

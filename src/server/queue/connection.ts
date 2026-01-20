import { Redis } from "ioredis";

let queueConnection: Redis | null = null;

/**
 * Get a singleton Redis connection for BullMQ queues.
 * Uses REDIS_URL env var with localhost fallback.
 * maxRetriesPerRequest: null is required for BullMQ workers.
 */
export function getQueueConnection(): Redis {
  if (!queueConnection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    queueConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ workers
    });

    queueConnection.on("error", (err) => {
      console.error("[Queue] Redis connection error:", err);
    });
  }
  return queueConnection;
}

import type { ConnectionOptions } from "bullmq";

/**
 * Get connection options for BullMQ queues and workers.
 * Uses REDIS_URL env var with localhost fallback.
 * Returns options object rather than Redis instance to avoid
 * type conflicts between project ioredis and BullMQ's bundled version.
 */
export function getQueueConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  // Parse URL to extract host/port/password
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ workers
  };
}

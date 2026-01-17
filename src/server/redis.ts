import { Redis } from "ioredis";

/**
 * Create a Redis client from REDIS_URL environment variable.
 * Defaults to redis://localhost:6379 if not set.
 */
export function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  return new Redis(redisUrl);
}

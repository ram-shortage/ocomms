import { Redis } from "ioredis";

/**
 * Create a Redis client from REDIS_URL environment variable.
 * Defaults to redis://localhost:6379 if not set.
 */
export function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  return new Redis(redisUrl);
}

// Initialize Redis client for last-visited storage
const redis = createRedisClient();

/**
 * Store the last-visited path for a user in a workspace.
 * Expires after 30 days.
 *
 * @param userId - User ID
 * @param workspaceId - Workspace (organization) ID
 * @param path - Path to store (e.g., "/acme/general")
 */
export async function storeLastVisited(
  userId: string,
  workspaceId: string,
  path: string
): Promise<void> {
  const key = `user:${userId}:workspace:${workspaceId}:last-visited`;
  const ttl = 60 * 60 * 24 * 30; // 30 days in seconds
  await redis.set(key, path, "EX", ttl);
}

/**
 * Get the last-visited path for a user in a workspace.
 *
 * @param userId - User ID
 * @param workspaceId - Workspace (organization) ID
 * @returns The last-visited path, or null if not set
 */
export async function getLastVisited(
  userId: string,
  workspaceId: string
): Promise<string | null> {
  const key = `user:${userId}:workspace:${workspaceId}:last-visited`;
  return await redis.get(key);
}

import { createRedisClient } from "@/server/redis";
import type { Redis } from "ioredis";

/**
 * Redis-backed session store for immediate session validation and revocation.
 *
 * Key patterns:
 * - sess:valid:{sessionId} -> "1" with TTL (marks session as valid)
 * - user:{userId}:sessions -> SET of sessionIds
 *
 * This enables:
 * - Instant session revocation (logout all devices)
 * - Session invalidation on password change
 * - Per-session device tracking
 */

// Singleton Redis client
let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

/**
 * Add a session to the user's session index.
 * @param userId - User ID
 * @param sessionId - Session ID
 * @param ttlSeconds - TTL in seconds (should match better-auth session expiry)
 */
export async function addUserSession(
  userId: string,
  sessionId: string,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();

  // Mark session as valid with TTL
  pipeline.setex(`sess:valid:${sessionId}`, ttlSeconds, "1");

  // Add session to user's session set
  pipeline.sadd(`user:${userId}:sessions`, sessionId);

  await pipeline.exec();
}

/**
 * Remove a session from the user's session index.
 * @param userId - User ID
 * @param sessionId - Session ID
 */
export async function removeUserSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();

  // Remove session validity marker
  pipeline.del(`sess:valid:${sessionId}`);

  // Remove session from user's session set
  pipeline.srem(`user:${userId}:sessions`, sessionId);

  await pipeline.exec();
}

/**
 * Revoke all sessions for a user (except optionally one session).
 * Used for "logout all devices" and password change.
 * @param userId - User ID
 * @param exceptSessionId - Optional session ID to keep active
 */
export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId?: string
): Promise<void> {
  const redis = getRedis();

  // Get all sessions for user
  const sessionIds = await redis.smembers(`user:${userId}:sessions`);

  if (sessionIds.length === 0) {
    return;
  }

  const pipeline = redis.pipeline();

  // Delete validity markers for all sessions (except the exception)
  for (const sessionId of sessionIds) {
    if (sessionId !== exceptSessionId) {
      pipeline.del(`sess:valid:${sessionId}`);
    }
  }

  // Clear the user's session set
  pipeline.del(`user:${userId}:sessions`);

  // If we're keeping one session, add it back
  if (exceptSessionId) {
    pipeline.sadd(`user:${userId}:sessions`, exceptSessionId);
  }

  await pipeline.exec();
}

/**
 * Validate if a session is still valid in Redis.
 * @param sessionId - Session ID
 * @returns true if session is valid, false otherwise
 */
export async function validateSession(sessionId: string): Promise<boolean> {
  const redis = getRedis();
  const exists = await redis.exists(`sess:valid:${sessionId}`);
  return exists === 1;
}

/**
 * Get all active session IDs for a user.
 * @param userId - User ID
 * @returns Array of session IDs
 */
export async function getUserSessions(userId: string): Promise<string[]> {
  const redis = getRedis();
  return await redis.smembers(`user:${userId}:sessions`);
}

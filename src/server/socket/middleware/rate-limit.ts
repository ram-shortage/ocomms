/**
 * Socket.IO rate limiting middleware.
 * SEC2-04: Prevents rapid-fire event abuse on Socket.IO handlers.
 *
 * Uses rate-limiter-flexible for in-memory rate limiting.
 * Configuration tuned to allow normal page loads while preventing abuse:
 * - 1000 events/sec sustained rate (handles initial page load with many reactions)
 * - 2 second cooldown on limit hit (short enough to not frustrate legitimate users)
 */
import { RateLimiterMemory } from "rate-limiter-flexible";
import type { Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/socket-events";

type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Rate limiter configuration
// 1000 events per second allows for page load scenarios where many events fire at once:
// - workspace:join, presence:fetch, notification:fetch
// - reaction:get for each visible message (can be 30-50+ messages)
// - typing indicators, presence updates, etc.
// The 2 second cooldown is short enough to not block legitimate users if they
// somehow hit the limit, while still preventing sustained abuse.
const rateLimiter = new RateLimiterMemory({
  points: 1000, // 1000 events
  duration: 1, // per 1 second
  blockDuration: 2, // 2 second cooldown after limit hit
});

/**
 * Rate limiting middleware for Socket.IO events.
 * Applied as socket-level middleware to rate limit all events globally per user.
 *
 * Uses socket.data.userId as the rate limit key (not socket.id or IP address)
 * to ensure rate limits apply per authenticated user across all their sockets.
 *
 * When rate limited:
 * - Emits 'rate-limit' event with message and retryAfter time
 * - Does NOT call next() - blocks the event from being processed
 *
 * @param event - The event tuple [eventName, ...args]
 * @param next - Callback to proceed to next middleware/handler
 */
export async function rateLimitMiddleware(
  socket: SocketWithData,
  next: (err?: Error) => void
): Promise<void> {
  // This middleware is applied via socket.use() which intercepts events
  // The actual rate limiting happens in the event interceptor below
  next();
}

/**
 * Creates an event-level rate limiter for a socket.
 * Call this after authentication to set up rate limiting on all events.
 *
 * @param socket - The authenticated socket instance
 */
export function createEventRateLimiter(socket: SocketWithData) {
  socket.use(async (event, next) => {
    const userId = socket.data.userId;

    // Skip rate limiting if no user ID (shouldn't happen after auth middleware)
    if (!userId) {
      next();
      return;
    }

    try {
      await rateLimiter.consume(userId);
      next();
    } catch (rateLimiterRes) {
      // Rate limit exceeded
      const res = rateLimiterRes as { msBeforeNext?: number };
      const retryAfter = res.msBeforeNext ?? 5000;

      socket.emit("error", {
        message: "Slow down",
        code: "RATE_LIMIT",
        retryAfter,
      });

      console.log(
        `[Socket.IO] Rate limit hit for user ${userId}: blocked for ${retryAfter}ms`
      );

      // Don't call next() - blocks the event from being processed
    }
  });
}

// Export the limiter for testing purposes
export { rateLimiter };

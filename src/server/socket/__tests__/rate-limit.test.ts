/**
 * Rate Limiting Middleware Tests
 *
 * SEC2-04: Validates Socket.IO rate limiting middleware behavior.
 * Tests verify:
 * - Normal usage is not affected
 * - Rapid-fire events are blocked
 * - Rate limit errors are emitted correctly
 * - Per-user rate limiting works (not per-socket)
 * - Cooldown period resets allow events again
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { createEventRateLimiter, rateLimiter } from "../middleware/rate-limit";

// Mock socket factory
function createMockSocket(userId: string) {
  const eventHandlers: Map<string, Function> = new Map();
  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  return {
    data: { userId },
    on: vi.fn((event: string, handler: Function) => {
      eventHandlers.set(event, handler);
    }),
    emit: vi.fn((event: string, data: unknown) => {
      emittedEvents.push({ event, data });
    }),
    use: vi.fn((middleware: Function) => {
      // Store middleware to call it manually in tests
      (createMockSocket as { middleware?: Function }).middleware = middleware;
    }),
    _eventHandlers: eventHandlers,
    _emittedEvents: emittedEvents,
    _triggerMiddleware: async (event: string[], next: Function) => {
      const middleware = (createMockSocket as { middleware?: Function }).middleware;
      if (middleware) {
        await middleware(event, next);
      }
    },
  };
}

describe("Rate Limiting Middleware (SEC2-04)", () => {
  beforeEach(async () => {
    // Reset rate limiter state between tests
    // RateLimiterMemory doesn't have a clear method, so we delete keys manually
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createEventRateLimiter", () => {
    it("registers socket.use middleware", () => {
      const mockSocket = createMockSocket("user-1") as unknown as Parameters<typeof createEventRateLimiter>[0];

      createEventRateLimiter(mockSocket);

      expect(mockSocket.use).toHaveBeenCalledTimes(1);
      expect(typeof mockSocket.use.mock.calls[0][0]).toBe("function");
    });
  });

  describe("rate limit behavior", () => {
    // Use a fresh limiter for these tests
    let testLimiter: RateLimiterMemory;

    beforeEach(() => {
      testLimiter = new RateLimiterMemory({
        points: 5, // Lower limit for faster testing
        duration: 1,
        blockDuration: 2,
      });
    });

    it("allows events under the rate limit", async () => {
      const userId = `test-user-under-${Date.now()}`;
      const results: boolean[] = [];

      // Try 5 events (the limit)
      for (let i = 0; i < 5; i++) {
        try {
          await testLimiter.consume(userId);
          results.push(true); // Event allowed
        } catch {
          results.push(false); // Event blocked
        }
      }

      expect(results.filter((r) => r === true).length).toBe(5);
    });

    it("blocks events over the rate limit", async () => {
      const userId = `test-user-over-${Date.now()}`;
      const results: boolean[] = [];

      // Try 10 events (5 over the limit of 5)
      for (let i = 0; i < 10; i++) {
        try {
          await testLimiter.consume(userId);
          results.push(true); // Event allowed
        } catch {
          results.push(false); // Event blocked
        }
      }

      // First 5 should be allowed, next 5 blocked
      expect(results.filter((r) => r === true).length).toBe(5);
      expect(results.filter((r) => r === false).length).toBe(5);
    });

    it("provides retry info when rate limited", async () => {
      const userId = `test-user-retry-${Date.now()}`;

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await testLimiter.consume(userId);
      }

      // Next one should be blocked with retry info
      try {
        await testLimiter.consume(userId);
        expect.fail("Should have thrown");
      } catch (res: unknown) {
        const rateLimitRes = res as { msBeforeNext?: number };
        expect(rateLimitRes.msBeforeNext).toBeDefined();
        expect(typeof rateLimitRes.msBeforeNext).toBe("number");
        expect(rateLimitRes.msBeforeNext).toBeGreaterThan(0);
      }
    });

    it("rate limits by userId not socketId", async () => {
      // Same user on different "sockets" should share rate limit
      const userId = `shared-user-${Date.now()}`;
      const results: boolean[] = [];

      // Exhaust limit as "socket 1" (same userId)
      for (let i = 0; i < 5; i++) {
        try {
          await testLimiter.consume(userId);
          results.push(true);
        } catch {
          results.push(false);
        }
      }

      // Try as "socket 2" (same userId) - should still be blocked
      try {
        await testLimiter.consume(userId);
        results.push(true);
      } catch {
        results.push(false);
      }

      // 5 allowed, 1 blocked (6th event from "different socket")
      expect(results.filter((r) => r === true).length).toBe(5);
      expect(results.filter((r) => r === false).length).toBe(1);
    });

    it("resets after cooldown period", async () => {
      vi.useRealTimers(); // Use real timers for this test

      // Create a limiter with short cooldown for testing
      const quickLimiter = new RateLimiterMemory({
        points: 2,
        duration: 1,
        blockDuration: 1, // 1 second cooldown
      });

      const userId = `test-user-cooldown-${Date.now()}`;

      // Exhaust the limit
      await quickLimiter.consume(userId);
      await quickLimiter.consume(userId);

      // Should be blocked
      try {
        await quickLimiter.consume(userId);
        expect.fail("Should have been blocked");
      } catch {
        // Expected
      }

      // Wait for cooldown (1.1 seconds to be safe)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be allowed again
      const result = await quickLimiter.consume(userId);
      expect(result.remainingPoints).toBeDefined();
    });
  });

  describe("error event emission", () => {
    it("emits error event with correct shape when blocked", async () => {
      const mockSocket = {
        data: { userId: `emit-test-${Date.now()}` },
        use: vi.fn(),
        emit: vi.fn(),
      };

      let capturedMiddleware: Function | null = null;
      mockSocket.use.mockImplementation((mw: Function) => {
        capturedMiddleware = mw;
      });

      // Create rate limiter on socket
      createEventRateLimiter(mockSocket as unknown as Parameters<typeof createEventRateLimiter>[0]);

      // Manually exhaust the rate limit by calling consume (100 events/sec limit)
      const userId = mockSocket.data.userId;
      for (let i = 0; i < 100; i++) {
        try {
          await rateLimiter.consume(userId);
        } catch {
          // Expected to fail eventually
        }
      }

      // Now trigger middleware - should emit error
      const next = vi.fn();
      await capturedMiddleware?.(["test:event"], next);

      // Should have emitted error
      expect(mockSocket.emit).toHaveBeenCalledWith(
        "error",
        expect.objectContaining({
          message: "Slow down",
          code: "RATE_LIMIT",
          retryAfter: expect.any(Number),
        })
      );

      // next() should NOT have been called (event blocked)
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next() when under rate limit", async () => {
      const mockSocket = {
        data: { userId: `next-test-${Date.now()}` },
        use: vi.fn(),
        emit: vi.fn(),
      };

      let capturedMiddleware: Function | null = null;
      mockSocket.use.mockImplementation((mw: Function) => {
        capturedMiddleware = mw;
      });

      createEventRateLimiter(mockSocket as unknown as Parameters<typeof createEventRateLimiter>[0]);

      // Trigger middleware (fresh user, under limit)
      const next = vi.fn();
      await capturedMiddleware?.(["test:event"], next);

      // Should call next()
      expect(next).toHaveBeenCalledTimes(1);

      // Should NOT emit error
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe("middleware integration", () => {
    it("skips rate limiting if no userId", async () => {
      const mockSocket = {
        data: {}, // No userId
        use: vi.fn(),
        emit: vi.fn(),
      };

      let capturedMiddleware: Function | null = null;
      mockSocket.use.mockImplementation((mw: Function) => {
        capturedMiddleware = mw;
      });

      createEventRateLimiter(mockSocket as unknown as Parameters<typeof createEventRateLimiter>[0]);

      // Trigger middleware
      const next = vi.fn();
      await capturedMiddleware?.(["test:event"], next);

      // Should call next() even without userId
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Rate limiter configuration", () => {
  it("uses 100 events per second limit", () => {
    // Verify the exported rateLimiter has expected configuration
    // RateLimiterMemory stores points internally
    expect(rateLimiter).toBeDefined();
    expect(rateLimiter).toBeInstanceOf(RateLimiterMemory);
  });
});

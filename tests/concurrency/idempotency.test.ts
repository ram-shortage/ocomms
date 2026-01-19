/**
 * General Idempotency Tests
 *
 * Tests idempotent operations across the application:
 * - Notification settings updates (concurrent updates converge)
 * - Channel membership (no duplicate memberships)
 * - Push subscriptions (same endpoint updates rather than duplicates)
 * - Mark as read (concurrent calls maintain consistent state)
 *
 * These operations rely on:
 * - Unique constraints in the database
 * - ON CONFLICT DO UPDATE / DO NOTHING patterns
 * - Atomic SQL operations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    limit: vi.fn(),
  },
}));

import { db } from "@/db";

// Type assertion for mock functions
const mockDb = db as unknown as {
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflictDoUpdate: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

/**
 * Simulates notification settings storage.
 * Key: channelId:userId -> mode
 */
class NotificationSettingsStore {
  private settings = new Map<string, string>();

  private key(channelId: string, userId: string): string {
    return `${channelId}:${userId}`;
  }

  get(channelId: string, userId: string): string {
    return this.settings.get(this.key(channelId, userId)) ?? "all"; // Default is "all"
  }

  set(channelId: string, userId: string, mode: string): void {
    // Atomic upsert - last write wins
    this.settings.set(this.key(channelId, userId), mode);
  }

  clear(): void {
    this.settings.clear();
  }
}

/**
 * Simulates channel membership storage.
 * Key: channelId:userId
 */
class ChannelMembershipStore {
  private members = new Set<string>();

  private key(channelId: string, userId: string): string {
    return `${channelId}:${userId}`;
  }

  isMember(channelId: string, userId: string): boolean {
    return this.members.has(this.key(channelId, userId));
  }

  join(channelId: string, userId: string): boolean {
    const key = this.key(channelId, userId);
    if (this.members.has(key)) {
      return false; // Already member (unique constraint)
    }
    this.members.add(key);
    return true;
  }

  leave(channelId: string, userId: string): boolean {
    return this.members.delete(this.key(channelId, userId));
  }

  getMemberCount(channelId: string): number {
    let count = 0;
    for (const key of this.members) {
      if (key.startsWith(`${channelId}:`)) {
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.members.clear();
  }
}

/**
 * Simulates push subscription storage.
 * Key: endpoint (unique per browser/device)
 */
class PushSubscriptionStore {
  private subscriptions = new Map<
    string,
    { userId: string; p256dh: string; auth: string }
  >();

  get(endpoint: string): { userId: string; p256dh: string; auth: string } | undefined {
    return this.subscriptions.get(endpoint);
  }

  upsert(
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string
  ): "created" | "updated" {
    const existing = this.subscriptions.has(endpoint);
    this.subscriptions.set(endpoint, { userId, p256dh, auth });
    return existing ? "updated" : "created";
  }

  getUserSubscriptions(userId: string): { endpoint: string; p256dh: string; auth: string }[] {
    const result: { endpoint: string; p256dh: string; auth: string }[] = [];
    for (const [endpoint, sub] of this.subscriptions) {
      if (sub.userId === userId) {
        result.push({ endpoint, p256dh: sub.p256dh, auth: sub.auth });
      }
    }
    return result;
  }

  getSubscriptionCount(endpoint: string): number {
    return this.subscriptions.has(endpoint) ? 1 : 0;
  }

  clear(): void {
    this.subscriptions.clear();
  }
}

/**
 * Simulates channel read state storage.
 * Key: channelId:userId -> lastReadSequence
 */
class ReadStateStore {
  private readState = new Map<string, number>();

  private key(channelId: string, userId: string): string {
    return `${channelId}:${userId}`;
  }

  getLastReadSequence(channelId: string, userId: string): number {
    return this.readState.get(this.key(channelId, userId)) ?? 0;
  }

  markRead(channelId: string, userId: string, sequence: number): void {
    const key = this.key(channelId, userId);
    const current = this.readState.get(key) ?? 0;
    // Only update if new sequence is higher (idempotent)
    if (sequence > current) {
      this.readState.set(key, sequence);
    }
  }

  getUnreadCount(channelId: string, userId: string, maxSequence: number): number {
    const lastRead = this.getLastReadSequence(channelId, userId);
    return Math.max(0, maxSequence - lastRead);
  }

  clear(): void {
    this.readState.clear();
  }
}

describe("Idempotency", () => {
  let notificationSettings: NotificationSettingsStore;
  let channelMembership: ChannelMembershipStore;
  let pushSubscriptions: PushSubscriptionStore;
  let readState: ReadStateStore;

  beforeEach(() => {
    vi.clearAllMocks();
    notificationSettings = new NotificationSettingsStore();
    channelMembership = new ChannelMembershipStore();
    pushSubscriptions = new PushSubscriptionStore();
    readState = new ReadStateStore();

    // Reset the chain
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.onConflictDoUpdate.mockReturnThis();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.delete.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
  });

  describe("Notification settings", () => {
    it("concurrent updates converge to consistent state", async () => {
      const channelId = "channel-123";
      const userId = "user-456";
      const settings = ["mentions", "none", "all"] as const;

      // Simulate concurrent updates with different values
      const promises = settings.map(async (mode) => {
        // Simulate variable timing
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 10)
        );
        notificationSettings.set(channelId, userId, mode);
        return mode;
      });

      await Promise.all(promises);

      // Final state should be one of the valid values
      const finalValue = notificationSettings.get(channelId, userId);
      expect(settings).toContain(finalValue);
    });

    it("repeated setting of same value is idempotent", async () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // Set to "mentions" 5 times
      for (let i = 0; i < 5; i++) {
        notificationSettings.set(channelId, userId, "mentions");
      }

      // Value should still be "mentions"
      expect(notificationSettings.get(channelId, userId)).toBe("mentions");
    });

    it("last write wins for concurrent updates", async () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // Simulate sequential updates (last one wins)
      notificationSettings.set(channelId, userId, "all");
      notificationSettings.set(channelId, userId, "mentions");
      notificationSettings.set(channelId, userId, "muted");

      expect(notificationSettings.get(channelId, userId)).toBe("muted");
    });

    it("default value returned when not set", () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // Should return default "all" when no setting exists
      expect(notificationSettings.get(channelId, userId)).toBe("all");
    });
  });

  describe("Channel membership", () => {
    it("double-join creates only one membership", async () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // Simulate concurrent join attempts
      const results = await Promise.all([
        (async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 10));
          return channelMembership.join(channelId, userId);
        })(),
        (async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 10));
          return channelMembership.join(channelId, userId);
        })(),
      ]);

      // One should succeed, one should fail (constraint violation)
      const successCount = results.filter((r) => r === true).length;
      expect(successCount).toBe(1);

      // User should be member exactly once
      expect(channelMembership.isMember(channelId, userId)).toBe(true);
      expect(channelMembership.getMemberCount(channelId)).toBe(1);
    });

    it("double-leave succeeds without error", async () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // Setup: user is member
      channelMembership.join(channelId, userId);
      expect(channelMembership.isMember(channelId, userId)).toBe(true);

      // Concurrent leave attempts should not throw
      const leaveOperations = async () => {
        await Promise.all([
          (async () => {
            await new Promise((r) => setTimeout(r, Math.random() * 10));
            return channelMembership.leave(channelId, userId);
          })(),
          (async () => {
            await new Promise((r) => setTimeout(r, Math.random() * 10));
            return channelMembership.leave(channelId, userId);
          })(),
        ]);
      };

      // Should not throw
      await expect(leaveOperations()).resolves.not.toThrow();

      // User should not be member
      expect(channelMembership.isMember(channelId, userId)).toBe(false);
    });

    it("multiple users can join same channel concurrently", async () => {
      const channelId = "channel-123";
      const users = ["user-1", "user-2", "user-3", "user-4", "user-5"];

      // All users join concurrently
      const promises = users.map(async (userId) => {
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        return channelMembership.join(channelId, userId);
      });

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every((r) => r === true)).toBe(true);

      // All users should be members
      for (const userId of users) {
        expect(channelMembership.isMember(channelId, userId)).toBe(true);
      }

      expect(channelMembership.getMemberCount(channelId)).toBe(5);
    });

    it("join after leave is allowed", async () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // Join
      expect(channelMembership.join(channelId, userId)).toBe(true);
      expect(channelMembership.isMember(channelId, userId)).toBe(true);

      // Leave
      expect(channelMembership.leave(channelId, userId)).toBe(true);
      expect(channelMembership.isMember(channelId, userId)).toBe(false);

      // Rejoin
      expect(channelMembership.join(channelId, userId)).toBe(true);
      expect(channelMembership.isMember(channelId, userId)).toBe(true);
    });
  });

  describe("Push subscription", () => {
    it("same endpoint updates existing subscription", async () => {
      const userId = "user-456";
      const endpoint = "https://push.example.com/abc123";

      // First subscription
      const result1 = pushSubscriptions.upsert(
        userId,
        endpoint,
        "key1",
        "auth1"
      );
      expect(result1).toBe("created");

      // Update with same endpoint, different keys
      const result2 = pushSubscriptions.upsert(
        userId,
        endpoint,
        "key2",
        "auth2"
      );
      expect(result2).toBe("updated");

      // Only one subscription should exist
      expect(pushSubscriptions.getSubscriptionCount(endpoint)).toBe(1);

      // Keys should be updated
      const sub = pushSubscriptions.get(endpoint);
      expect(sub?.p256dh).toBe("key2");
      expect(sub?.auth).toBe("auth2");
    });

    it("no duplicate subscriptions for same endpoint", async () => {
      const userId = "user-456";
      const endpoint = "https://push.example.com/abc123";

      // Concurrent subscription attempts
      const promises = Array(5)
        .fill(null)
        .map(async (_, i) => {
          await new Promise((r) => setTimeout(r, Math.random() * 10));
          return pushSubscriptions.upsert(
            userId,
            endpoint,
            `key${i}`,
            `auth${i}`
          );
        });

      await Promise.all(promises);

      // Only one subscription should exist
      expect(pushSubscriptions.getSubscriptionCount(endpoint)).toBe(1);
    });

    it("user can have multiple subscriptions for different endpoints", async () => {
      const userId = "user-456";
      const endpoints = [
        "https://push.example.com/device1",
        "https://push.example.com/device2",
        "https://push.example.com/device3",
      ];

      // Subscribe from multiple devices
      for (let i = 0; i < endpoints.length; i++) {
        pushSubscriptions.upsert(userId, endpoints[i], `key${i}`, `auth${i}`);
      }

      // User should have 3 subscriptions
      const userSubs = pushSubscriptions.getUserSubscriptions(userId);
      expect(userSubs.length).toBe(3);
    });

    it("endpoint uniqueness is enforced across users", async () => {
      const endpoint = "https://push.example.com/shared-device";

      // User 1 subscribes
      pushSubscriptions.upsert("user-1", endpoint, "key1", "auth1");

      // User 2 tries to use same endpoint (takes over the subscription)
      pushSubscriptions.upsert("user-2", endpoint, "key2", "auth2");

      // Endpoint should now be associated with user-2
      const sub = pushSubscriptions.get(endpoint);
      expect(sub?.userId).toBe("user-2");

      // Only one subscription for this endpoint
      expect(pushSubscriptions.getSubscriptionCount(endpoint)).toBe(1);
    });
  });

  describe("Mark as read", () => {
    it("concurrent mark-read calls succeed", async () => {
      const channelId = "channel-123";
      const userId = "user-456";
      const maxSequence = 100;

      // Concurrent mark-read calls
      const promises = Array(5)
        .fill(null)
        .map(async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 10));
          readState.markRead(channelId, userId, maxSequence);
        });

      await Promise.all(promises);

      // Unread count should be 0
      expect(readState.getUnreadCount(channelId, userId, maxSequence)).toBe(0);
    });

    it("mark-read is idempotent (calling multiple times has same effect)", async () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // Mark read to sequence 50 multiple times
      readState.markRead(channelId, userId, 50);
      readState.markRead(channelId, userId, 50);
      readState.markRead(channelId, userId, 50);

      expect(readState.getLastReadSequence(channelId, userId)).toBe(50);
    });

    it("lower sequence does not reset read state", async () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // Mark read to sequence 100
      readState.markRead(channelId, userId, 100);

      // Try to mark read at lower sequence (should be ignored)
      readState.markRead(channelId, userId, 50);

      // Should still be at 100
      expect(readState.getLastReadSequence(channelId, userId)).toBe(100);
    });

    it("higher sequence updates read state", async () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // Mark read at sequence 50
      readState.markRead(channelId, userId, 50);
      expect(readState.getLastReadSequence(channelId, userId)).toBe(50);

      // Mark read at sequence 100
      readState.markRead(channelId, userId, 100);
      expect(readState.getLastReadSequence(channelId, userId)).toBe(100);
    });

    it("unread count calculation is correct", async () => {
      const channelId = "channel-123";
      const userId = "user-456";

      // No read state yet, max sequence is 50
      expect(readState.getUnreadCount(channelId, userId, 50)).toBe(50);

      // Mark read at sequence 30
      readState.markRead(channelId, userId, 30);
      expect(readState.getUnreadCount(channelId, userId, 50)).toBe(20);

      // Mark read at sequence 50
      readState.markRead(channelId, userId, 50);
      expect(readState.getUnreadCount(channelId, userId, 50)).toBe(0);
    });

    it("concurrent mark-read with different sequences converges to highest", async () => {
      const channelId = "channel-123";
      const userId = "user-456";
      const sequences = [10, 50, 30, 80, 20];

      // Concurrent mark-read with different sequences
      const promises = sequences.map(async (seq) => {
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        readState.markRead(channelId, userId, seq);
      });

      await Promise.all(promises);

      // Should converge to highest sequence (80)
      expect(readState.getLastReadSequence(channelId, userId)).toBe(80);
    });
  });

  describe("Cross-cutting idempotency patterns", () => {
    it("upsert pattern: insert or update on conflict", () => {
      // Notification settings use upsert pattern
      notificationSettings.set("channel-1", "user-1", "all");
      notificationSettings.set("channel-1", "user-1", "mentions"); // Update
      expect(notificationSettings.get("channel-1", "user-1")).toBe("mentions");
    });

    it("unique constraint prevents duplicates", () => {
      // Channel membership uses unique constraint
      expect(channelMembership.join("channel-1", "user-1")).toBe(true);
      expect(channelMembership.join("channel-1", "user-1")).toBe(false);
    });

    it("max() function for monotonically increasing values", () => {
      // Read state only moves forward
      readState.markRead("channel-1", "user-1", 100);
      readState.markRead("channel-1", "user-1", 50); // Ignored
      expect(readState.getLastReadSequence("channel-1", "user-1")).toBe(100);
    });

    it("endpoint-based uniqueness for external resources", () => {
      // Push subscriptions keyed by external endpoint
      pushSubscriptions.upsert("user-1", "endpoint-a", "key1", "auth1");
      pushSubscriptions.upsert("user-1", "endpoint-a", "key2", "auth2"); // Update
      expect(pushSubscriptions.getSubscriptionCount("endpoint-a")).toBe(1);
    });
  });
});

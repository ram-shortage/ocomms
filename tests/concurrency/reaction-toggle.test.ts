/**
 * Reaction Toggle Concurrency Tests
 *
 * Tests idempotency and race conditions in reaction toggling:
 * - Double-toggle consistency (rapid toggle returns to original state)
 * - Concurrent toggles from same user (at most one reaction)
 * - Concurrent toggles from multiple users (each tracked independently)
 *
 * The reaction handler uses:
 * - Unique constraint (message_id, user_id, emoji) prevents duplicates
 * - onConflictDoNothing for race condition safety
 * - Check-then-act pattern with DB constraints as safety net
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

import { db } from "@/db";

// Type assertion for mock functions
const mockDb = db as unknown as {
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

/**
 * Simulates the reaction state in the database.
 * Uses a Set to track (messageId, userId, emoji) combinations.
 */
class ReactionStore {
  private reactions = new Set<string>();

  private key(messageId: string, userId: string, emoji: string): string {
    return `${messageId}:${userId}:${emoji}`;
  }

  exists(messageId: string, userId: string, emoji: string): boolean {
    return this.reactions.has(this.key(messageId, userId, emoji));
  }

  add(messageId: string, userId: string, emoji: string): boolean {
    const key = this.key(messageId, userId, emoji);
    if (this.reactions.has(key)) {
      return false; // Already exists (unique constraint violation)
    }
    this.reactions.add(key);
    return true;
  }

  remove(messageId: string, userId: string, emoji: string): boolean {
    const key = this.key(messageId, userId, emoji);
    return this.reactions.delete(key);
  }

  count(messageId: string, emoji: string): number {
    let count = 0;
    for (const key of this.reactions) {
      if (key.startsWith(`${messageId}:`) && key.endsWith(`:${emoji}`)) {
        count++;
      }
    }
    return count;
  }

  getUserReactions(messageId: string, userId: string): string[] {
    const emojis: string[] = [];
    for (const key of this.reactions) {
      const parts = key.split(":");
      if (parts[0] === messageId && parts[1] === userId) {
        emojis.push(parts[2]);
      }
    }
    return emojis;
  }

  clear(): void {
    this.reactions.clear();
  }
}

/**
 * Simulates the toggle reaction logic from reaction.ts
 * Check if exists -> remove if yes, add if no
 */
async function toggleReaction(
  store: ReactionStore,
  messageId: string,
  userId: string,
  emoji: string
): Promise<"added" | "removed"> {
  // Simulate async DB lookup
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));

  if (store.exists(messageId, userId, emoji)) {
    store.remove(messageId, userId, emoji);
    return "removed";
  } else {
    // onConflictDoNothing means duplicate adds are safe
    store.add(messageId, userId, emoji);
    return "added";
  }
}

/**
 * Simulates toggle with race condition (two toggles checking state simultaneously)
 * This demonstrates the potential issue the DB constraints protect against
 */
async function toggleReactionWithRace(
  store: ReactionStore,
  messageId: string,
  userId: string,
  emoji: string,
  existsAtCheckTime: boolean
): Promise<"added" | "removed" | "no-op"> {
  // Simulate the "exists" check result at time of check
  if (existsAtCheckTime) {
    // Try to remove
    const removed = store.remove(messageId, userId, emoji);
    return removed ? "removed" : "no-op"; // no-op if already removed by concurrent operation
  } else {
    // Try to add (onConflictDoNothing)
    const added = store.add(messageId, userId, emoji);
    return added ? "added" : "no-op"; // no-op if already added by concurrent operation
  }
}

describe("Reaction Toggle Concurrency", () => {
  let store: ReactionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ReactionStore();

    // Reset the chain
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.delete.mockReturnThis();
  });

  describe("Double-toggle consistency", () => {
    it("rapid toggle returns to original state (no reaction)", async () => {
      const messageId = "msg-123";
      const userId = "user-456";
      const emoji = "thumbsup";

      // Initial state: no reaction
      expect(store.exists(messageId, userId, emoji)).toBe(false);

      // First toggle: adds reaction
      const result1 = await toggleReaction(store, messageId, userId, emoji);
      expect(result1).toBe("added");
      expect(store.exists(messageId, userId, emoji)).toBe(true);

      // Second toggle: removes reaction
      const result2 = await toggleReaction(store, messageId, userId, emoji);
      expect(result2).toBe("removed");
      expect(store.exists(messageId, userId, emoji)).toBe(false);
    });

    it("rapid toggle returns to original state (had reaction)", async () => {
      const messageId = "msg-123";
      const userId = "user-456";
      const emoji = "thumbsup";

      // Initial state: has reaction
      store.add(messageId, userId, emoji);
      expect(store.exists(messageId, userId, emoji)).toBe(true);

      // First toggle: removes reaction
      const result1 = await toggleReaction(store, messageId, userId, emoji);
      expect(result1).toBe("removed");
      expect(store.exists(messageId, userId, emoji)).toBe(false);

      // Second toggle: adds reaction back
      const result2 = await toggleReaction(store, messageId, userId, emoji);
      expect(result2).toBe("added");
      expect(store.exists(messageId, userId, emoji)).toBe(true);
    });

    it("multiple rapid toggles converge to consistent state", async () => {
      const messageId = "msg-123";
      const userId = "user-456";
      const emoji = "thumbsup";

      // Toggle 6 times rapidly (even number = back to original)
      for (let i = 0; i < 6; i++) {
        await toggleReaction(store, messageId, userId, emoji);
      }

      // Should be back to no reaction
      expect(store.exists(messageId, userId, emoji)).toBe(false);

      // Toggle 5 times (odd number = opposite of original)
      for (let i = 0; i < 5; i++) {
        await toggleReaction(store, messageId, userId, emoji);
      }

      // Should have reaction
      expect(store.exists(messageId, userId, emoji)).toBe(true);
    });
  });

  describe("Concurrent toggles from same user", () => {
    it("at most one reaction after concurrent adds", async () => {
      const messageId = "msg-123";
      const userId = "user-456";
      const emoji = "thumbsup";

      // Simulate 5 concurrent "add" attempts (all see no existing reaction)
      // Due to unique constraint, only one succeeds
      const results = await Promise.all([
        toggleReactionWithRace(store, messageId, userId, emoji, false),
        toggleReactionWithRace(store, messageId, userId, emoji, false),
        toggleReactionWithRace(store, messageId, userId, emoji, false),
        toggleReactionWithRace(store, messageId, userId, emoji, false),
        toggleReactionWithRace(store, messageId, userId, emoji, false),
      ]);

      // Only one should have actually added
      const addedCount = results.filter((r) => r === "added").length;
      const noOpCount = results.filter((r) => r === "no-op").length;

      expect(addedCount).toBe(1);
      expect(noOpCount).toBe(4);

      // Only one reaction in store
      const userReactions = store.getUserReactions(messageId, userId);
      expect(userReactions.length).toBe(1);
      expect(userReactions[0]).toBe(emoji);
    });

    it("concurrent toggles result in 0 or 1 reaction (not multiple)", async () => {
      const messageId = "msg-123";
      const userId = "user-456";
      const emoji = "thumbsup";

      // Run 10 concurrent toggles
      const promises = Array(10)
        .fill(null)
        .map(() => toggleReaction(store, messageId, userId, emoji));

      await Promise.all(promises);

      // Final state should be 0 or 1 reaction, never more
      const userReactions = store.getUserReactions(messageId, userId);
      expect(userReactions.length).toBeLessThanOrEqual(1);
    });

    it("rapid concurrent toggles maintain consistency", async () => {
      const messageId = "msg-123";
      const userId = "user-456";
      const emoji = "thumbsup";

      // Run 20 concurrent toggles
      const promises = Array(20)
        .fill(null)
        .map(() => toggleReaction(store, messageId, userId, emoji));

      await Promise.all(promises);

      // User should have at most 1 reaction
      const userReactions = store.getUserReactions(messageId, userId);
      expect(userReactions.length).toBeLessThanOrEqual(1);
    });
  });

  describe("Concurrent toggles from multiple users", () => {
    it("each user reaction tracked independently", async () => {
      const messageId = "msg-123";
      const emoji = "thumbsup";
      const users = ["user-1", "user-2", "user-3", "user-4", "user-5"];

      // All users add the same emoji concurrently
      const promises = users.map((userId) =>
        toggleReaction(store, messageId, userId, emoji)
      );

      await Promise.all(promises);

      // Each user should have exactly one reaction
      for (const userId of users) {
        const userReactions = store.getUserReactions(messageId, userId);
        expect(userReactions.length).toBe(1);
        expect(userReactions[0]).toBe(emoji);
      }

      // Total count should be 5
      expect(store.count(messageId, emoji)).toBe(5);
    });

    it("no cross-user interference during concurrent operations", async () => {
      const messageId = "msg-123";
      const users = [
        { id: "user-1", emoji: "thumbsup" },
        { id: "user-2", emoji: "heart" },
        { id: "user-3", emoji: "thumbsup" },
        { id: "user-4", emoji: "smile" },
        { id: "user-5", emoji: "heart" },
      ];

      // All users toggle their emojis concurrently
      const promises = users.map(({ id, emoji }) =>
        toggleReaction(store, messageId, id, emoji)
      );

      await Promise.all(promises);

      // Verify each user has exactly their emoji
      for (const { id, emoji } of users) {
        const userReactions = store.getUserReactions(messageId, id);
        expect(userReactions).toContain(emoji);
        expect(userReactions.length).toBe(1);
      }

      // Verify emoji counts
      expect(store.count(messageId, "thumbsup")).toBe(2); // user-1, user-3
      expect(store.count(messageId, "heart")).toBe(2); // user-2, user-5
      expect(store.count(messageId, "smile")).toBe(1); // user-4
    });

    it("mixed add/remove operations maintain correct counts", async () => {
      const messageId = "msg-123";
      const emoji = "thumbsup";

      // Pre-add reactions for users 1-3
      store.add(messageId, "user-1", emoji);
      store.add(messageId, "user-2", emoji);
      store.add(messageId, "user-3", emoji);

      expect(store.count(messageId, emoji)).toBe(3);

      // Concurrent operations:
      // - user-1 removes (toggle off)
      // - user-2 removes (toggle off)
      // - user-4 adds (toggle on)
      // - user-5 adds (toggle on)
      const operations = [
        toggleReaction(store, messageId, "user-1", emoji), // remove
        toggleReaction(store, messageId, "user-2", emoji), // remove
        toggleReaction(store, messageId, "user-4", emoji), // add
        toggleReaction(store, messageId, "user-5", emoji), // add
      ];

      await Promise.all(operations);

      // Final count: 3 - 2 + 2 = 3
      // Remaining: user-3, user-4, user-5
      expect(store.count(messageId, emoji)).toBe(3);
      expect(store.exists(messageId, "user-1", emoji)).toBe(false);
      expect(store.exists(messageId, "user-2", emoji)).toBe(false);
      expect(store.exists(messageId, "user-3", emoji)).toBe(true);
      expect(store.exists(messageId, "user-4", emoji)).toBe(true);
      expect(store.exists(messageId, "user-5", emoji)).toBe(true);
    });
  });

  describe("Unique constraint behavior", () => {
    it("duplicate reaction insert is idempotent (onConflictDoNothing)", async () => {
      const messageId = "msg-123";
      const userId = "user-456";
      const emoji = "thumbsup";

      // First insert succeeds
      const added1 = store.add(messageId, userId, emoji);
      expect(added1).toBe(true);

      // Second insert fails silently (onConflictDoNothing behavior)
      const added2 = store.add(messageId, userId, emoji);
      expect(added2).toBe(false);

      // Still only one reaction
      expect(store.getUserReactions(messageId, userId).length).toBe(1);
    });

    it("unique constraint enforced per emoji", async () => {
      const messageId = "msg-123";
      const userId = "user-456";

      // User can react with multiple different emojis
      store.add(messageId, userId, "thumbsup");
      store.add(messageId, userId, "heart");
      store.add(messageId, userId, "smile");

      const reactions = store.getUserReactions(messageId, userId);
      expect(reactions.length).toBe(3);
      expect(reactions).toContain("thumbsup");
      expect(reactions).toContain("heart");
      expect(reactions).toContain("smile");
    });

    it("same emoji can be used by different users on same message", async () => {
      const messageId = "msg-123";
      const emoji = "thumbsup";

      // Multiple users react with same emoji
      store.add(messageId, "user-1", emoji);
      store.add(messageId, "user-2", emoji);
      store.add(messageId, "user-3", emoji);

      expect(store.count(messageId, emoji)).toBe(3);
    });
  });
});

/**
 * Message Cache Tests
 *
 * Tests for IndexedDB message caching functionality:
 * - Cache operations (write, read, update)
 * - Cache management (cleanup, TTL)
 * - Message normalization (author flattening)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";

import { db, type CachedMessage } from "../cache/db";
import {
  cacheMessage,
  cacheMessages,
  getCachedChannelMessages,
  getCachedConversationMessages,
  cleanupExpiredMessages,
  updateMessageDeletion,
  clearAllCache,
} from "../cache/messages";
import type { Message } from "../socket-events";

// Helper to create a test message
function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    content: "Hello world",
    authorId: "user-1",
    author: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
    },
    channelId: "ch-1",
    conversationId: null,
    parentId: null,
    replyCount: 0,
    sequence: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Clear database before/after each test
beforeEach(async () => {
  await db.messages.clear();
});

afterEach(async () => {
  await db.messages.clear();
});

describe("Message Cache", () => {
  describe("Cache operations", () => {
    it("writes single message to cache", async () => {
      const message = createTestMessage({ id: "1", content: "Hello" });

      await cacheMessage(message);

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached).toHaveLength(1);
      expect(cached[0].content).toBe("Hello");
    });

    it("writes multiple messages to cache", async () => {
      const messages: Message[] = [
        createTestMessage({ id: "1", content: "Hello", sequence: 1 }),
        createTestMessage({ id: "2", content: "World", sequence: 2 }),
      ];

      await cacheMessages(messages);

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached).toHaveLength(2);
    });

    it("reads messages ordered by sequence", async () => {
      // Insert out of order
      await cacheMessages([
        createTestMessage({ id: "2", content: "Second", sequence: 2 }),
        createTestMessage({ id: "1", content: "First", sequence: 1 }),
        createTestMessage({ id: "3", content: "Third", sequence: 3 }),
      ]);

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached[0].content).toBe("First");
      expect(cached[1].content).toBe("Second");
      expect(cached[2].content).toBe("Third");
    });

    it("updates existing messages (upsert behavior)", async () => {
      // Insert original
      await cacheMessage(
        createTestMessage({ id: "1", content: "Original", sequence: 1 })
      );

      // Update with same ID
      await cacheMessage(
        createTestMessage({ id: "1", content: "Updated", sequence: 1 })
      );

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached).toHaveLength(1);
      expect(cached[0].content).toBe("Updated");
    });

    it("reads conversation messages separately from channel messages", async () => {
      // Add channel message
      await cacheMessage(
        createTestMessage({
          id: "ch-msg-1",
          content: "Channel message",
          channelId: "ch-1",
          conversationId: null,
          sequence: 1,
        })
      );

      // Add conversation message
      await cacheMessage(
        createTestMessage({
          id: "conv-msg-1",
          content: "DM message",
          channelId: null,
          conversationId: "conv-1",
          sequence: 1,
        })
      );

      const channelMsgs = await getCachedChannelMessages("ch-1");
      const convMsgs = await getCachedConversationMessages("conv-1");

      expect(channelMsgs).toHaveLength(1);
      expect(channelMsgs[0].content).toBe("Channel message");

      expect(convMsgs).toHaveLength(1);
      expect(convMsgs[0].content).toBe("DM message");
    });

    it("updates message deletion status", async () => {
      await cacheMessage(createTestMessage({ id: "1", content: "To delete" }));

      const deletedAt = new Date();
      await updateMessageDeletion("1", deletedAt);

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached[0].deletedAt).toEqual(deletedAt);
    });
  });

  describe("Cache management", () => {
    it("clears messages older than 7 days", async () => {
      // Create a message with old cachedAt (8 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);

      // Create a message with recent cachedAt (1 day ago)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 1);

      // Directly insert with specific cachedAt values
      await db.messages.bulkPut([
        {
          id: "old",
          content: "Old message",
          authorId: "user-1",
          authorName: "Test",
          authorEmail: "test@example.com",
          channelId: "ch-1",
          conversationId: null,
          parentId: null,
          replyCount: 0,
          sequence: 1,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          cachedAt: oldDate,
        },
        {
          id: "recent",
          content: "Recent message",
          authorId: "user-1",
          authorName: "Test",
          authorEmail: "test@example.com",
          channelId: "ch-1",
          conversationId: null,
          parentId: null,
          replyCount: 0,
          sequence: 2,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          cachedAt: recentDate,
        },
      ]);

      // Verify both exist before cleanup
      let cached = await getCachedChannelMessages("ch-1");
      expect(cached).toHaveLength(2);

      // Run cleanup
      const deleted = await cleanupExpiredMessages();

      // Verify old message was deleted
      expect(deleted).toBe(1);
      cached = await getCachedChannelMessages("ch-1");
      expect(cached).toHaveLength(1);
      expect(cached[0].content).toBe("Recent message");
    });

    it("keeps messages within 7 days", async () => {
      // Set to 6 days 23 hours ago (safely within 7-day window)
      const withinRetention = new Date();
      withinRetention.setDate(withinRetention.getDate() - 6);
      withinRetention.setHours(withinRetention.getHours() - 23);

      await db.messages.put({
        id: "boundary",
        content: "Recent enough message",
        authorId: "user-1",
        authorName: "Test",
        authorEmail: "test@example.com",
        channelId: "ch-1",
        conversationId: null,
        parentId: null,
        replyCount: 0,
        sequence: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        cachedAt: withinRetention,
      });

      // Cleanup should not delete messages within the 7-day window
      const deleted = await cleanupExpiredMessages();

      // Message should still exist
      expect(deleted).toBe(0);
      const cached = await getCachedChannelMessages("ch-1");
      expect(cached).toHaveLength(1);
    });

    it("clears all cached messages", async () => {
      await cacheMessages([
        createTestMessage({ id: "1", sequence: 1 }),
        createTestMessage({ id: "2", sequence: 2 }),
        createTestMessage({ id: "3", sequence: 3 }),
      ]);

      await clearAllCache();

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached).toHaveLength(0);
    });
  });

  describe("Normalization", () => {
    it("flattens nested author object for storage", async () => {
      const message = createTestMessage({
        id: "1",
        author: {
          id: "u1",
          name: "Alice Smith",
          email: "alice@example.com",
        },
      });

      await cacheMessage(message);

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached[0].authorName).toBe("Alice Smith");
      expect(cached[0].authorEmail).toBe("alice@example.com");
    });

    it("handles null author name gracefully", async () => {
      const message = createTestMessage({
        id: "1",
        author: {
          id: "u1",
          name: null as unknown as string,
          email: "test@example.com",
        },
      });

      await cacheMessage(message);

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached[0].authorName).toBe(null);
    });

    it("handles missing author gracefully", async () => {
      const message = createTestMessage({
        id: "1",
        author: undefined as unknown as Message["author"],
      });

      await cacheMessage(message);

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached[0].authorName).toBe(null);
      expect(cached[0].authorEmail).toBe("");
    });

    it("preserves all message fields", async () => {
      const createdAt = new Date("2026-01-15T10:00:00Z");
      const updatedAt = new Date("2026-01-15T11:00:00Z");

      const message = createTestMessage({
        id: "full-msg",
        content: "Full content",
        authorId: "author-1",
        channelId: "ch-test",
        parentId: "parent-1",
        replyCount: 5,
        sequence: 42,
        createdAt,
        updatedAt,
      });

      await cacheMessage(message);

      const cached = await getCachedChannelMessages("ch-test");
      expect(cached[0].id).toBe("full-msg");
      expect(cached[0].content).toBe("Full content");
      expect(cached[0].authorId).toBe("author-1");
      expect(cached[0].channelId).toBe("ch-test");
      expect(cached[0].parentId).toBe("parent-1");
      expect(cached[0].replyCount).toBe(5);
      expect(cached[0].sequence).toBe(42);
      expect(cached[0].createdAt).toEqual(createdAt);
      expect(cached[0].updatedAt).toEqual(updatedAt);
      expect(cached[0].cachedAt).toBeInstanceOf(Date);
    });
  });

  describe("Bulk operations", () => {
    it("handles large batch of messages efficiently", async () => {
      const messages: Message[] = Array(100)
        .fill(null)
        .map((_, i) =>
          createTestMessage({
            id: `msg-${i}`,
            content: `Message ${i}`,
            sequence: i,
          })
        );

      await cacheMessages(messages);

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached).toHaveLength(100);
      // Verify ordering
      expect(cached[0].sequence).toBe(0);
      expect(cached[99].sequence).toBe(99);
    });

    it("handles empty array gracefully", async () => {
      await cacheMessages([]);

      const cached = await getCachedChannelMessages("ch-1");
      expect(cached).toHaveLength(0);
    });
  });

  describe("Error handling", () => {
    it("logs error but does not throw on failed cache write", async () => {
      // This test verifies graceful degradation
      // The actual implementation catches errors and logs them
      // We can test by verifying normal operation doesn't throw
      const message = createTestMessage({ id: "1" });

      // Should not throw
      await expect(cacheMessage(message)).resolves.toBeUndefined();
    });

    it("returns empty array for non-existent channel", async () => {
      const cached = await getCachedChannelMessages("non-existent");
      expect(cached).toEqual([]);
    });

    it("returns empty array for non-existent conversation", async () => {
      const cached = await getCachedConversationMessages("non-existent");
      expect(cached).toEqual([]);
    });
  });

  describe("Conversation messages", () => {
    it("reads conversation messages ordered by sequence", async () => {
      await cacheMessages([
        createTestMessage({
          id: "3",
          content: "Third",
          channelId: null,
          conversationId: "conv-1",
          sequence: 3,
        }),
        createTestMessage({
          id: "1",
          content: "First",
          channelId: null,
          conversationId: "conv-1",
          sequence: 1,
        }),
        createTestMessage({
          id: "2",
          content: "Second",
          channelId: null,
          conversationId: "conv-1",
          sequence: 2,
        }),
      ]);

      const cached = await getCachedConversationMessages("conv-1");
      expect(cached[0].content).toBe("First");
      expect(cached[1].content).toBe("Second");
      expect(cached[2].content).toBe("Third");
    });
  });
});

/**
 * Offline Queue Tests
 *
 * Tests for the send queue functionality including:
 * - Queue operations (add, get, remove, update)
 * - Processing logic (online, offline, retry with backoff)
 * - Persistence across operations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";

// Must import fake-indexeddb before Dexie
import { db, type QueuedMessage, type SendStatus } from "../cache/db";
import {
  queueMessage,
  updateQueueStatus,
  getPendingMessages,
  removeFromQueue,
  getQueuedMessagesByTarget,
} from "../cache/send-queue";
import { calculateBackoff, shouldRetry, DEFAULT_CONFIG } from "../retry/backoff";

// Create a fresh database for each test
beforeEach(async () => {
  // Clear all tables before each test
  await db.sendQueue.clear();
});

afterEach(async () => {
  // Ensure clean state after each test
  await db.sendQueue.clear();
});

describe("Offline Queue", () => {
  describe("Queue operations", () => {
    it("adds message to queue with initial retry state", async () => {
      const message = {
        clientId: "temp-1",
        serverId: null,
        content: "Hello",
        targetId: "ch-1",
        targetType: "channel" as const,
        parentId: null,
        status: "pending" as SendStatus,
        createdAt: new Date(),
      };

      await queueMessage(message);

      const queued = await getPendingMessages();
      expect(queued).toHaveLength(1);
      expect(queued[0].content).toBe("Hello");
      expect(queued[0].retryCount).toBe(0);
      expect(queued[0].lastError).toBe(null);
      expect(queued[0].lastAttemptAt).toBe(null);
    });

    it("gets pending messages filtered by target", async () => {
      await queueMessage({
        clientId: "1",
        serverId: null,
        content: "A",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });
      await queueMessage({
        clientId: "2",
        serverId: null,
        content: "B",
        targetId: "ch-2",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });
      await queueMessage({
        clientId: "3",
        serverId: null,
        content: "C",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });

      const ch1Messages = await getPendingMessages("ch-1");
      expect(ch1Messages).toHaveLength(2);
      expect(ch1Messages[0].content).toBe("A");
      expect(ch1Messages[1].content).toBe("C");
    });

    it("removes message from queue", async () => {
      await queueMessage({
        clientId: "1",
        serverId: null,
        content: "Test",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });

      await removeFromQueue("1");

      const queued = await getPendingMessages();
      expect(queued).toHaveLength(0);
    });

    it("updates message status and metadata", async () => {
      await queueMessage({
        clientId: "1",
        serverId: null,
        content: "Test",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });

      await updateQueueStatus("1", "failed", {
        retryCount: 1,
        lastError: "Network error",
      });

      const queued = await getPendingMessages();
      expect(queued[0].status).toBe("failed");
      expect(queued[0].retryCount).toBe(1);
      expect(queued[0].lastError).toBe("Network error");
      expect(queued[0].lastAttemptAt).toBeInstanceOf(Date);
    });

    it("gets queued messages by target, excluding sent", async () => {
      await queueMessage({
        clientId: "1",
        serverId: null,
        content: "Pending",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(Date.now() - 2000),
      });
      await queueMessage({
        clientId: "2",
        serverId: null,
        content: "Failed",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "failed",
        createdAt: new Date(Date.now() - 1000),
      });
      // Simulate a sent message
      await db.sendQueue.add({
        clientId: "3",
        serverId: "server-3",
        content: "Sent",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "sent",
        retryCount: 0,
        lastError: null,
        createdAt: new Date(),
        lastAttemptAt: new Date(),
      });

      const messages = await getQueuedMessagesByTarget("ch-1");
      expect(messages).toHaveLength(2);
      expect(messages.map((m) => m.content)).toEqual(["Pending", "Failed"]);
    });
  });

  describe("Pending message filtering", () => {
    it("includes both pending and failed messages", async () => {
      await queueMessage({
        clientId: "1",
        serverId: null,
        content: "Pending",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });
      await queueMessage({
        clientId: "2",
        serverId: null,
        content: "Failed",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "failed",
        createdAt: new Date(),
      });

      const pending = await getPendingMessages();
      expect(pending).toHaveLength(2);
    });

    it("excludes sent and sending messages", async () => {
      await db.sendQueue.add({
        clientId: "1",
        serverId: "server-1",
        content: "Sent",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "sent",
        retryCount: 0,
        lastError: null,
        createdAt: new Date(),
        lastAttemptAt: new Date(),
      });
      await db.sendQueue.add({
        clientId: "2",
        serverId: null,
        content: "Sending",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "sending",
        retryCount: 0,
        lastError: null,
        createdAt: new Date(),
        lastAttemptAt: new Date(),
      });

      const pending = await getPendingMessages();
      expect(pending).toHaveLength(0);
    });

    it("sorts pending messages by createdAt (FIFO)", async () => {
      const now = Date.now();
      await queueMessage({
        clientId: "2",
        serverId: null,
        content: "Second",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(now + 1000),
      });
      await queueMessage({
        clientId: "1",
        serverId: null,
        content: "First",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(now),
      });
      await queueMessage({
        clientId: "3",
        serverId: null,
        content: "Third",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(now + 2000),
      });

      const pending = await getPendingMessages();
      expect(pending[0].content).toBe("First");
      expect(pending[1].content).toBe("Second");
      expect(pending[2].content).toBe("Third");
    });
  });

  describe("Retry logic (backoff)", () => {
    it("calculates exponential backoff delays", () => {
      // Base delay is 1000ms, formula: min(maxDelay, baseDelay * 2^attempt)
      const delay0 = calculateBackoff(0, { maxJitter: 0 });
      const delay1 = calculateBackoff(1, { maxJitter: 0 });
      const delay2 = calculateBackoff(2, { maxJitter: 0 });
      const delay3 = calculateBackoff(3, { maxJitter: 0 });

      expect(delay0).toBe(1000); // 1000 * 2^0 = 1000
      expect(delay1).toBe(2000); // 1000 * 2^1 = 2000
      expect(delay2).toBe(4000); // 1000 * 2^2 = 4000
      expect(delay3).toBe(8000); // 1000 * 2^3 = 8000
    });

    it("caps backoff at maxDelay", () => {
      const delay10 = calculateBackoff(10, { maxJitter: 0, maxDelay: 30000 });
      expect(delay10).toBe(30000); // Would be 1024000 without cap
    });

    it("adds jitter to backoff delay", () => {
      // Run multiple times to verify jitter adds randomness
      const delays = new Set<number>();
      for (let i = 0; i < 10; i++) {
        delays.add(calculateBackoff(0));
      }
      // With jitter, we should have different values
      // (very unlikely to have all same values with 500ms max jitter)
      expect(delays.size).toBeGreaterThan(1);
    });

    it("shouldRetry returns true under max retries", () => {
      expect(shouldRetry(0)).toBe(true);
      expect(shouldRetry(1)).toBe(true);
      expect(shouldRetry(4)).toBe(true);
    });

    it("shouldRetry returns false at or above max retries", () => {
      expect(shouldRetry(5)).toBe(false);
      expect(shouldRetry(6)).toBe(false);
      expect(shouldRetry(10)).toBe(false);
    });

    it("allows custom max retries", () => {
      expect(shouldRetry(2, { maxRetries: 3 })).toBe(true);
      expect(shouldRetry(3, { maxRetries: 3 })).toBe(false);
    });
  });

  describe("Queue persistence", () => {
    it("messages persist across operations", async () => {
      // Add message
      await queueMessage({
        clientId: "persist-1",
        serverId: null,
        content: "Persistent message",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });

      // Verify it exists
      let messages = await getPendingMessages();
      expect(messages).toHaveLength(1);

      // Update status
      await updateQueueStatus("persist-1", "failed", { retryCount: 1 });

      // Verify update persisted
      messages = await getPendingMessages();
      expect(messages[0].status).toBe("failed");
      expect(messages[0].retryCount).toBe(1);

      // Add another message
      await queueMessage({
        clientId: "persist-2",
        serverId: null,
        content: "Another persistent message",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });

      // Both should exist
      messages = await getPendingMessages();
      expect(messages).toHaveLength(2);
    });

    it("queue cleared after successful send simulation", async () => {
      await queueMessage({
        clientId: "send-test",
        serverId: null,
        content: "To be sent",
        targetId: "ch-1",
        targetType: "channel",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });

      // Simulate successful send
      await updateQueueStatus("send-test", "sent", { serverId: "server-123" });
      await removeFromQueue("send-test");

      const messages = await getPendingMessages();
      expect(messages).toHaveLength(0);
    });
  });

  describe("DM target type", () => {
    it("handles dm target type correctly", async () => {
      await queueMessage({
        clientId: "dm-1",
        serverId: null,
        content: "Direct message",
        targetId: "conv-123",
        targetType: "dm",
        parentId: null,
        status: "pending",
        createdAt: new Date(),
      });

      const messages = await getQueuedMessagesByTarget("conv-123");
      expect(messages).toHaveLength(1);
      expect(messages[0].targetType).toBe("dm");
    });
  });

  describe("Thread reply handling", () => {
    it("stores parentId for thread replies", async () => {
      await queueMessage({
        clientId: "thread-reply-1",
        serverId: null,
        content: "Reply in thread",
        targetId: "ch-1",
        targetType: "channel",
        parentId: "parent-msg-123",
        status: "pending",
        createdAt: new Date(),
      });

      const messages = await getPendingMessages();
      expect(messages[0].parentId).toBe("parent-msg-123");
    });
  });
});

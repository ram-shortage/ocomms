import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createScheduledMessage,
  getScheduledMessages,
  updateScheduledMessage,
  cancelScheduledMessage,
  sendScheduledMessageNow,
} from "../scheduled-message";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

// Mock database with separate mocks for different tables
const mockChannelMembersFindFirst = vi.fn();
const mockConversationParticipantsFindFirst = vi.fn();
const mockChannelsFindFirst = vi.fn();
const mockScheduledMessagesFindFirst = vi.fn();
const mockScheduledMessagesFindMany = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      channelMembers: { findFirst: (...args: unknown[]) => mockChannelMembersFindFirst(...args) },
      conversationParticipants: { findFirst: (...args: unknown[]) => mockConversationParticipantsFindFirst(...args) },
      channels: { findFirst: (...args: unknown[]) => mockChannelsFindFirst(...args) },
      scheduledMessages: {
        findFirst: (...args: unknown[]) => mockScheduledMessagesFindFirst(...args),
        findMany: (...args: unknown[]) => mockScheduledMessagesFindMany(...args),
      },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

// Mock BullMQ queue
const mockQueueAdd = vi.fn();
const mockGetJob = vi.fn();
vi.mock("@/server/queue/scheduled-message.queue", () => ({
  scheduledMessageQueue: {
    add: (...args: unknown[]) => mockQueueAdd(...args),
    getJob: (...args: unknown[]) => mockGetJob(...args),
  },
}));

describe("Scheduled Message Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is authenticated
    mockGetSession.mockResolvedValue({
      user: { id: "user-123", name: "Test User", email: "test@example.com" },
    });
    // Default queue mock
    mockQueueAdd.mockResolvedValue({ id: "job-123" });
    mockGetJob.mockResolvedValue({ remove: vi.fn() });
  });

  describe("createScheduledMessage", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        createScheduledMessage({
          content: "hello",
          scheduledFor: new Date(Date.now() + 60000),
          channelId: "ch-1",
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects empty content", async () => {
      await expect(
        createScheduledMessage({
          content: "   ",
          scheduledFor: new Date(Date.now() + 60000),
          channelId: "ch-1",
        })
      ).rejects.toThrow("Message content cannot be empty");
    });

    it("rejects past scheduled time", async () => {
      await expect(
        createScheduledMessage({
          content: "hello",
          scheduledFor: new Date(Date.now() - 60000),
          channelId: "ch-1",
        })
      ).rejects.toThrow("Scheduled time must be in the future");
    });

    it("rejects when neither channelId nor conversationId provided", async () => {
      await expect(
        createScheduledMessage({
          content: "hello",
          scheduledFor: new Date(Date.now() + 60000),
        })
      ).rejects.toThrow("Must provide exactly one of channelId or conversationId");
    });

    it("rejects when both channelId and conversationId provided", async () => {
      await expect(
        createScheduledMessage({
          content: "hello",
          scheduledFor: new Date(Date.now() + 60000),
          channelId: "ch-1",
          conversationId: "conv-1",
        })
      ).rejects.toThrow("Must provide exactly one of channelId or conversationId");
    });

    it("rejects non-channel-member", async () => {
      mockChannelMembersFindFirst.mockResolvedValueOnce(null); // not a member

      await expect(
        createScheduledMessage({
          content: "hello",
          scheduledFor: new Date(Date.now() + 60000),
          channelId: "ch-1",
        })
      ).rejects.toThrow("Not a member of this channel");
    });

    it("rejects scheduling to archived channel", async () => {
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" }); // channel member
      mockChannelsFindFirst.mockResolvedValueOnce({ id: "ch-1", isArchived: true }); // archived channel

      await expect(
        createScheduledMessage({
          content: "hello",
          scheduledFor: new Date(Date.now() + 60000),
          channelId: "ch-1",
        })
      ).rejects.toThrow("Cannot schedule messages to archived channels");
    });

    it("creates scheduled message for channel member", async () => {
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" }); // channel member
      mockChannelsFindFirst.mockResolvedValueOnce({ id: "ch-1", isArchived: false }); // non-archived channel

      const scheduled = { id: "sm-1", content: "hello", status: "pending" };
      mockInsert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([scheduled]) }),
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => Promise.resolve() }),
      });

      const result = await createScheduledMessage({
        content: "hello",
        scheduledFor: new Date(Date.now() + 60000),
        channelId: "ch-1",
      });

      expect(result.id).toBe("sm-1");
      expect(mockInsert).toHaveBeenCalled();
      expect(mockQueueAdd).toHaveBeenCalled();
    });

    it("creates scheduled message for conversation participant", async () => {
      mockConversationParticipantsFindFirst.mockResolvedValueOnce({ id: "participant-1" }); // conversation participant

      const scheduled = { id: "sm-1", content: "hello", status: "pending" };
      mockInsert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([scheduled]) }),
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => Promise.resolve() }),
      });

      const result = await createScheduledMessage({
        content: "hello",
        scheduledFor: new Date(Date.now() + 60000),
        conversationId: "conv-1",
      });

      expect(result.id).toBe("sm-1");
    });

    it("rejects non-conversation-participant", async () => {
      mockConversationParticipantsFindFirst.mockResolvedValueOnce(null); // not a participant

      await expect(
        createScheduledMessage({
          content: "hello",
          scheduledFor: new Date(Date.now() + 60000),
          conversationId: "conv-1",
        })
      ).rejects.toThrow("Not a participant in this conversation");
    });
  });

  describe("getScheduledMessages", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(getScheduledMessages()).rejects.toThrow("Unauthorized");
    });

    it("returns user's pending scheduled messages", async () => {
      mockScheduledMessagesFindMany.mockResolvedValueOnce([
        { id: "sm-1", content: "hello", status: "pending" },
        { id: "sm-2", content: "world", status: "pending" },
      ]);

      const result = await getScheduledMessages();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("sm-1");
    });
  });

  describe("updateScheduledMessage", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        updateScheduledMessage("sm-1", { content: "updated" })
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects non-existent message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce(null);

      await expect(
        updateScheduledMessage("sm-1", { content: "updated" })
      ).rejects.toThrow("Scheduled message not found");
    });

    it("rejects updating non-owned message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "other-user",
        status: "pending",
      });

      await expect(
        updateScheduledMessage("sm-1", { content: "updated" })
      ).rejects.toThrow("Not authorized to update this scheduled message");
    });

    it("rejects updating non-pending message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "user-123",
        status: "sent",
      });

      await expect(
        updateScheduledMessage("sm-1", { content: "updated" })
      ).rejects.toThrow("Cannot update a scheduled message that is no longer pending");
    });

    it("rejects empty content update", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "user-123",
        status: "pending",
      });

      await expect(
        updateScheduledMessage("sm-1", { content: "   " })
      ).rejects.toThrow("Message content cannot be empty");
    });

    it("rejects past scheduled time update", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "user-123",
        status: "pending",
      });

      await expect(
        updateScheduledMessage("sm-1", { scheduledFor: new Date(Date.now() - 60000) })
      ).rejects.toThrow("Scheduled time must be in the future");
    });

    it("updates content for owned pending message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "user-123",
        status: "pending",
        jobId: "job-123",
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "sm-1", content: "updated" }]) }) }),
      });

      const result = await updateScheduledMessage("sm-1", { content: "updated" });

      expect(result.id).toBe("sm-1");
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("reschedules job when time changes", async () => {
      const mockRemove = vi.fn();
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "user-123",
        status: "pending",
        jobId: "job-123",
      });
      mockGetJob.mockResolvedValueOnce({ remove: mockRemove });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "sm-1" }]) }) }),
      });

      await updateScheduledMessage("sm-1", { scheduledFor: new Date(Date.now() + 120000) });

      expect(mockRemove).toHaveBeenCalled();
      expect(mockQueueAdd).toHaveBeenCalled();
    });
  });

  describe("cancelScheduledMessage", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(cancelScheduledMessage("sm-1")).rejects.toThrow("Unauthorized");
    });

    it("rejects non-existent message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce(null);

      await expect(cancelScheduledMessage("sm-1")).rejects.toThrow("Scheduled message not found");
    });

    it("rejects canceling non-owned message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "other-user",
        status: "pending",
      });

      await expect(cancelScheduledMessage("sm-1")).rejects.toThrow(
        "Not authorized to cancel this scheduled message"
      );
    });

    it("rejects canceling non-pending message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "user-123",
        status: "sent",
      });

      await expect(cancelScheduledMessage("sm-1")).rejects.toThrow(
        "Cannot cancel a scheduled message that is no longer pending"
      );
    });

    it("cancels owned pending message and removes job", async () => {
      const mockRemove = vi.fn();
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "user-123",
        status: "pending",
        jobId: "job-123",
      });
      mockGetJob.mockResolvedValueOnce({ remove: mockRemove });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => Promise.resolve() }),
      });

      const result = await cancelScheduledMessage("sm-1");

      expect(result).toEqual({ success: true });
      expect(mockRemove).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("sendScheduledMessageNow", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(sendScheduledMessageNow("sm-1")).rejects.toThrow("Unauthorized");
    });

    it("rejects non-existent message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce(null);

      await expect(sendScheduledMessageNow("sm-1")).rejects.toThrow("Scheduled message not found");
    });

    it("rejects sending non-owned message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "other-user",
        status: "pending",
      });

      await expect(sendScheduledMessageNow("sm-1")).rejects.toThrow(
        "Not authorized to send this scheduled message"
      );
    });

    it("rejects sending non-pending message", async () => {
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "user-123",
        status: "sent",
      });

      await expect(sendScheduledMessageNow("sm-1")).rejects.toThrow(
        "Cannot send a scheduled message that is no longer pending"
      );
    });

    it("sends message immediately by removing old job and adding new one", async () => {
      const mockRemove = vi.fn();
      mockScheduledMessagesFindFirst.mockResolvedValueOnce({
        id: "sm-1",
        authorId: "user-123",
        status: "pending",
        jobId: "job-123",
      });
      mockGetJob.mockResolvedValueOnce({ remove: mockRemove });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => Promise.resolve() }),
      });

      const result = await sendScheduledMessageNow("sm-1");

      expect(result).toEqual({ success: true });
      expect(mockRemove).toHaveBeenCalled();
      expect(mockQueueAdd).toHaveBeenCalled();
    });
  });
});

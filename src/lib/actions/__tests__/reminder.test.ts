import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createReminder,
  getReminders,
  getReminder,
  snoozeReminder,
  completeReminder,
  cancelReminder,
  getMessageIdsWithReminders,
} from "../reminder";

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
const mockMessagesFindFirst = vi.fn();
const mockChannelMembersFindFirst = vi.fn();
const mockConversationParticipantsFindFirst = vi.fn();
const mockRemindersFindFirst = vi.fn();
const mockRemindersFindMany = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      messages: { findFirst: (...args: unknown[]) => mockMessagesFindFirst(...args) },
      channelMembers: { findFirst: (...args: unknown[]) => mockChannelMembersFindFirst(...args) },
      conversationParticipants: { findFirst: (...args: unknown[]) => mockConversationParticipantsFindFirst(...args) },
      reminders: {
        findFirst: (...args: unknown[]) => mockRemindersFindFirst(...args),
        findMany: (...args: unknown[]) => mockRemindersFindMany(...args),
      },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

// Mock BullMQ queue
const mockQueueAdd = vi.fn();
const mockGetJob = vi.fn();
const mockUpsertJobScheduler = vi.fn();
const mockRemoveJobScheduler = vi.fn();
vi.mock("@/server/queue/reminder.queue", () => ({
  reminderQueue: {
    add: (...args: unknown[]) => mockQueueAdd(...args),
    getJob: (...args: unknown[]) => mockGetJob(...args),
    upsertJobScheduler: (...args: unknown[]) => mockUpsertJobScheduler(...args),
    removeJobScheduler: (...args: unknown[]) => mockRemoveJobScheduler(...args),
  },
}));

describe("Reminder Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is authenticated
    mockGetSession.mockResolvedValue({
      user: { id: "user-123", name: "Test User", email: "test@example.com" },
    });
    // Default queue mock
    mockQueueAdd.mockResolvedValue({ id: "job-123" });
    mockGetJob.mockResolvedValue({ remove: vi.fn() });
    mockUpsertJobScheduler.mockResolvedValue({});
    mockRemoveJobScheduler.mockResolvedValue({});
  });

  describe("createReminder", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        createReminder({
          messageId: "msg-1",
          remindAt: new Date(Date.now() + 60000),
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects when message not found", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce(null);

      await expect(
        createReminder({
          messageId: "msg-1",
          remindAt: new Date(Date.now() + 60000),
        })
      ).rejects.toThrow("Message not found or access denied");
    });

    it("rejects when user is not channel member", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce(null); // not a member

      await expect(
        createReminder({
          messageId: "msg-1",
          remindAt: new Date(Date.now() + 60000),
        })
      ).rejects.toThrow("Message not found or access denied");
    });

    it("rejects when user is not conversation participant", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", conversationId: "conv-1" });
      mockConversationParticipantsFindFirst.mockResolvedValueOnce(null); // not a participant

      await expect(
        createReminder({
          messageId: "msg-1",
          remindAt: new Date(Date.now() + 60000),
        })
      ).rejects.toThrow("Message not found or access denied");
    });

    it("rejects past reminder time", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" });

      await expect(
        createReminder({
          messageId: "msg-1",
          remindAt: new Date(Date.now() - 60000),
        })
      ).rejects.toThrow("Reminder time must be in the future");
    });

    it("creates reminder for accessible channel message", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" });

      const reminder = { id: "rem-1", messageId: "msg-1", status: "pending" };
      mockInsert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([reminder]) }),
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => Promise.resolve() }),
      });

      const result = await createReminder({
        messageId: "msg-1",
        remindAt: new Date(Date.now() + 60000),
      });

      expect(result.id).toBe("rem-1");
      expect(mockInsert).toHaveBeenCalled();
      expect(mockQueueAdd).toHaveBeenCalled();
    });

    it("creates reminder for accessible DM message", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", conversationId: "conv-1" });
      mockConversationParticipantsFindFirst.mockResolvedValueOnce({ id: "participant-1" });

      const reminder = { id: "rem-1", messageId: "msg-1", status: "pending" };
      mockInsert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([reminder]) }),
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => Promise.resolve() }),
      });

      const result = await createReminder({
        messageId: "msg-1",
        remindAt: new Date(Date.now() + 60000),
      });

      expect(result.id).toBe("rem-1");
    });

    it("creates recurring daily reminder", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" });

      const reminder = { id: "rem-1", messageId: "msg-1", status: "pending", recurringPattern: "daily" };
      mockInsert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([reminder]) }),
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => Promise.resolve() }),
      });

      const result = await createReminder({
        messageId: "msg-1",
        remindAt: new Date(Date.now() + 60000),
        recurringPattern: "daily",
      });

      expect(result.id).toBe("rem-1");
      expect(mockUpsertJobScheduler).toHaveBeenCalled();
      expect(mockQueueAdd).not.toHaveBeenCalled(); // recurring uses scheduler, not add
    });

    it("creates recurring weekly reminder", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" });

      const reminder = { id: "rem-1", messageId: "msg-1", status: "pending", recurringPattern: "weekly" };
      mockInsert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([reminder]) }),
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => Promise.resolve() }),
      });

      const result = await createReminder({
        messageId: "msg-1",
        remindAt: new Date(Date.now() + 60000),
        recurringPattern: "weekly",
      });

      expect(result.id).toBe("rem-1");
      expect(mockUpsertJobScheduler).toHaveBeenCalled();
    });

    it("creates reminder with optional note", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" });

      const reminder = { id: "rem-1", messageId: "msg-1", note: "Follow up on this", status: "pending" };
      mockInsert.mockReturnValue({
        values: () => ({ returning: () => Promise.resolve([reminder]) }),
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => Promise.resolve() }),
      });

      const result = await createReminder({
        messageId: "msg-1",
        remindAt: new Date(Date.now() + 60000),
        note: "Follow up on this",
      });

      expect(result.id).toBe("rem-1");
    });
  });

  describe("getReminders", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(getReminders()).rejects.toThrow("Unauthorized");
    });

    it("returns user's active reminders", async () => {
      mockRemindersFindMany.mockResolvedValueOnce([
        { id: "rem-1", status: "pending", message: { id: "msg-1" } },
        { id: "rem-2", status: "fired", message: { id: "msg-2" } },
      ]);

      const result = await getReminders();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("rem-1");
    });

    it("includes completed reminders when requested", async () => {
      mockRemindersFindMany.mockResolvedValueOnce([
        { id: "rem-1", status: "pending", message: { id: "msg-1" } },
        { id: "rem-2", status: "completed", message: { id: "msg-2" } },
      ]);

      const result = await getReminders(true);

      expect(result).toHaveLength(2);
    });
  });

  describe("getReminder", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(getReminder("rem-1")).rejects.toThrow("Unauthorized");
    });

    it("returns reminder for owner", async () => {
      mockRemindersFindFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user-123",
        status: "pending",
        message: { id: "msg-1" },
      });

      const result = await getReminder("rem-1");

      expect(result?.id).toBe("rem-1");
    });

    it("returns null when reminder not found or not owned", async () => {
      mockRemindersFindFirst.mockResolvedValueOnce(null);

      const result = await getReminder("rem-1");

      expect(result).toBeNull();
    });
  });

  describe("snoozeReminder", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(snoozeReminder("rem-1", "20min")).rejects.toThrow("Unauthorized");
    });

    it("rejects snoozing non-owned reminder", async () => {
      mockRemindersFindFirst.mockResolvedValueOnce(null); // not found (ownership enforced in query)

      await expect(snoozeReminder("rem-1", "20min")).rejects.toThrow("Reminder not found");
    });

    it("snoozes reminder for 20 minutes", async () => {
      const mockRemove = vi.fn();
      mockRemindersFindFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user-123",
        status: "fired",
        jobId: "job-123",
      });
      mockGetJob.mockResolvedValueOnce({ remove: mockRemove });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "rem-1", status: "snoozed" }]) }) }),
      });

      const result = await snoozeReminder("rem-1", "20min");

      expect(result.id).toBe("rem-1");
      expect(mockRemove).toHaveBeenCalled();
      expect(mockQueueAdd).toHaveBeenCalled();
    });

    it("snoozes reminder for 1 hour", async () => {
      const mockRemove = vi.fn();
      mockRemindersFindFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user-123",
        status: "fired",
        jobId: "job-123",
      });
      mockGetJob.mockResolvedValueOnce({ remove: mockRemove });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "rem-1", status: "snoozed" }]) }) }),
      });

      const result = await snoozeReminder("rem-1", "1hour");

      expect(result.status).toBe("snoozed");
    });

    it("snoozes reminder for 3 hours", async () => {
      mockRemindersFindFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user-123",
        status: "fired",
        jobId: null, // no existing job
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "rem-1", status: "snoozed" }]) }) }),
      });

      const result = await snoozeReminder("rem-1", "3hours");

      expect(result.status).toBe("snoozed");
      expect(mockQueueAdd).toHaveBeenCalled();
    });

    it("snoozes reminder until tomorrow 9am", async () => {
      mockRemindersFindFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user-123",
        status: "fired",
        jobId: null,
      });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "rem-1", status: "snoozed" }]) }) }),
      });

      const result = await snoozeReminder("rem-1", "tomorrow");

      expect(result.status).toBe("snoozed");
    });
  });

  describe("completeReminder", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(completeReminder("rem-1")).rejects.toThrow("Unauthorized");
    });

    it("rejects completing non-owned reminder", async () => {
      mockRemindersFindFirst.mockResolvedValueOnce(null);

      await expect(completeReminder("rem-1")).rejects.toThrow("Reminder not found");
    });

    it("completes owned reminder and removes job", async () => {
      const mockRemove = vi.fn();
      mockRemindersFindFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user-123",
        status: "fired",
        jobId: "job-123",
        recurringPattern: null,
      });
      mockGetJob.mockResolvedValueOnce({ remove: mockRemove });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "rem-1", status: "completed" }]) }) }),
      });

      const result = await completeReminder("rem-1");

      expect(result.status).toBe("completed");
      expect(mockRemove).toHaveBeenCalled();
    });

    it("completes recurring reminder and removes scheduler", async () => {
      const mockRemove = vi.fn();
      mockRemindersFindFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user-123",
        status: "fired",
        jobId: "job-123",
        recurringPattern: "daily",
      });
      mockGetJob.mockResolvedValueOnce({ remove: mockRemove });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "rem-1", status: "completed" }]) }) }),
      });

      const result = await completeReminder("rem-1");

      expect(result.status).toBe("completed");
      expect(mockRemoveJobScheduler).toHaveBeenCalled();
    });
  });

  describe("cancelReminder", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(cancelReminder("rem-1")).rejects.toThrow("Unauthorized");
    });

    it("rejects canceling non-owned reminder", async () => {
      mockRemindersFindFirst.mockResolvedValueOnce(null);

      await expect(cancelReminder("rem-1")).rejects.toThrow("Reminder not found");
    });

    it("cancels owned reminder", async () => {
      const mockRemove = vi.fn();
      mockRemindersFindFirst.mockResolvedValueOnce({
        id: "rem-1",
        userId: "user-123",
        status: "pending",
        jobId: "job-123",
        recurringPattern: null,
      });
      mockGetJob.mockResolvedValueOnce({ remove: mockRemove });
      mockUpdate.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "rem-1", status: "cancelled" }]) }) }),
      });

      const result = await cancelReminder("rem-1");

      expect(result.status).toBe("cancelled");
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe("getMessageIdsWithReminders", () => {
    it("returns empty array for unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await getMessageIdsWithReminders();

      expect(result).toEqual([]);
    });

    it("returns message IDs with active reminders", async () => {
      mockRemindersFindMany.mockResolvedValueOnce([
        { messageId: "msg-1" },
        { messageId: "msg-2" },
        { messageId: "msg-3" },
      ]);

      const result = await getMessageIdsWithReminders();

      expect(result).toEqual(["msg-1", "msg-2", "msg-3"]);
    });
  });
});

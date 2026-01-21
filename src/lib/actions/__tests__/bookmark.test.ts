import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toggleBookmark,
  getBookmarks,
  isBookmarked,
  getBookmarkedMessageIds,
  removeBookmark,
} from "../bookmark";

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
const mockFileAttachmentsFindFirst = vi.fn();
const mockChannelMembersFindFirst = vi.fn();
const mockConversationParticipantsFindFirst = vi.fn();
const mockBookmarksFindFirst = vi.fn();
const mockBookmarksFindMany = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      messages: { findFirst: (...args: unknown[]) => mockMessagesFindFirst(...args) },
      fileAttachments: { findFirst: (...args: unknown[]) => mockFileAttachmentsFindFirst(...args) },
      channelMembers: { findFirst: (...args: unknown[]) => mockChannelMembersFindFirst(...args) },
      conversationParticipants: { findFirst: (...args: unknown[]) => mockConversationParticipantsFindFirst(...args) },
      bookmarks: {
        findFirst: (...args: unknown[]) => mockBookmarksFindFirst(...args),
        findMany: (...args: unknown[]) => mockBookmarksFindMany(...args),
      },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe("Bookmark Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is authenticated
    mockGetSession.mockResolvedValue({
      user: { id: "user-123", name: "Test User", email: "test@example.com" },
    });
  });

  describe("toggleBookmark", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        toggleBookmark({ type: "message", messageId: "msg-1" })
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects message bookmark without messageId", async () => {
      await expect(
        toggleBookmark({ type: "message" })
      ).rejects.toThrow("messageId required for message bookmarks");
    });

    it("rejects file bookmark without fileId", async () => {
      await expect(
        toggleBookmark({ type: "file" })
      ).rejects.toThrow("fileId required for file bookmarks");
    });

    it("rejects when message not found", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce(null);

      await expect(
        toggleBookmark({ type: "message", messageId: "msg-1" })
      ).rejects.toThrow("Message not found or access denied");
    });

    it("rejects when user is not channel member for message", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce(null);

      await expect(
        toggleBookmark({ type: "message", messageId: "msg-1" })
      ).rejects.toThrow("Message not found or access denied");
    });

    it("rejects when user is not conversation participant for message", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", conversationId: "conv-1" });
      mockConversationParticipantsFindFirst.mockResolvedValueOnce(null);

      await expect(
        toggleBookmark({ type: "message", messageId: "msg-1" })
      ).rejects.toThrow("Message not found or access denied");
    });

    it("rejects when file not found", async () => {
      mockFileAttachmentsFindFirst.mockResolvedValueOnce(null);

      await expect(
        toggleBookmark({ type: "file", fileId: "file-1" })
      ).rejects.toThrow("File not found");
    });

    it("rejects when file message access denied", async () => {
      mockFileAttachmentsFindFirst.mockResolvedValueOnce({ id: "file-1", messageId: "msg-1" });
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce(null);

      await expect(
        toggleBookmark({ type: "file", fileId: "file-1" })
      ).rejects.toThrow("File not found or access denied");
    });

    it("adds bookmark when not already bookmarked", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" });
      mockBookmarksFindFirst.mockResolvedValueOnce(null); // no existing bookmark

      mockInsert.mockReturnValue({
        values: () => Promise.resolve(),
      });

      const result = await toggleBookmark({ type: "message", messageId: "msg-1" });

      expect(result).toEqual({ bookmarked: true });
      expect(mockInsert).toHaveBeenCalled();
    });

    it("removes bookmark when already bookmarked", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" });
      mockBookmarksFindFirst.mockResolvedValueOnce({ id: "bm-1", userId: "user-123", messageId: "msg-1" }); // existing bookmark

      mockDelete.mockReturnValue({
        where: () => Promise.resolve(),
      });

      const result = await toggleBookmark({ type: "message", messageId: "msg-1" });

      expect(result).toEqual({ bookmarked: false });
      expect(mockDelete).toHaveBeenCalled();
    });

    it("adds file bookmark when file has no message", async () => {
      mockFileAttachmentsFindFirst.mockResolvedValueOnce({ id: "file-1", messageId: null }); // standalone file
      mockBookmarksFindFirst.mockResolvedValueOnce(null);

      mockInsert.mockReturnValue({
        values: () => Promise.resolve(),
      });

      const result = await toggleBookmark({ type: "file", fileId: "file-1" });

      expect(result).toEqual({ bookmarked: true });
    });

    it("adds file bookmark when file message is accessible", async () => {
      mockFileAttachmentsFindFirst.mockResolvedValueOnce({ id: "file-1", messageId: "msg-1" });
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", channelId: "ch-1" });
      mockChannelMembersFindFirst.mockResolvedValueOnce({ id: "member-1" });
      mockBookmarksFindFirst.mockResolvedValueOnce(null);

      mockInsert.mockReturnValue({
        values: () => Promise.resolve(),
      });

      const result = await toggleBookmark({ type: "file", fileId: "file-1" });

      expect(result).toEqual({ bookmarked: true });
    });

    it("handles DM message access for bookmark", async () => {
      mockMessagesFindFirst.mockResolvedValueOnce({ id: "msg-1", conversationId: "conv-1" });
      mockConversationParticipantsFindFirst.mockResolvedValueOnce({ id: "participant-1" });
      mockBookmarksFindFirst.mockResolvedValueOnce(null);

      mockInsert.mockReturnValue({
        values: () => Promise.resolve(),
      });

      const result = await toggleBookmark({ type: "message", messageId: "msg-1" });

      expect(result).toEqual({ bookmarked: true });
    });
  });

  describe("getBookmarks", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(getBookmarks()).rejects.toThrow("Unauthorized");
    });

    it("returns user's bookmarks with relations", async () => {
      mockBookmarksFindMany.mockResolvedValueOnce([
        { id: "bm-1", type: "message", messageId: "msg-1", message: { id: "msg-1", content: "test" } },
        { id: "bm-2", type: "file", fileId: "file-1", file: { id: "file-1", name: "test.pdf" } },
      ]);

      const result = await getBookmarks();

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("message");
      expect(result[1].type).toBe("file");
    });

    it("returns empty array when no bookmarks", async () => {
      mockBookmarksFindMany.mockResolvedValueOnce([]);

      const result = await getBookmarks();

      expect(result).toEqual([]);
    });
  });

  describe("isBookmarked", () => {
    it("returns false for unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await isBookmarked("msg-1");

      expect(result).toBe(false);
    });

    it("returns true when message is bookmarked", async () => {
      mockBookmarksFindFirst.mockResolvedValueOnce({ id: "bm-1", messageId: "msg-1" });

      const result = await isBookmarked("msg-1");

      expect(result).toBe(true);
    });

    it("returns false when message is not bookmarked", async () => {
      mockBookmarksFindFirst.mockResolvedValueOnce(null);

      const result = await isBookmarked("msg-1");

      expect(result).toBe(false);
    });
  });

  describe("getBookmarkedMessageIds", () => {
    it("returns empty array for unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await getBookmarkedMessageIds();

      expect(result).toEqual([]);
    });

    it("returns message IDs of bookmarked messages", async () => {
      mockBookmarksFindMany.mockResolvedValueOnce([
        { messageId: "msg-1" },
        { messageId: "msg-2" },
        { messageId: "msg-3" },
      ]);

      const result = await getBookmarkedMessageIds();

      expect(result).toEqual(["msg-1", "msg-2", "msg-3"]);
    });

    it("filters out null message IDs", async () => {
      mockBookmarksFindMany.mockResolvedValueOnce([
        { messageId: "msg-1" },
        { messageId: null },
        { messageId: "msg-3" },
      ]);

      const result = await getBookmarkedMessageIds();

      expect(result).toEqual(["msg-1", "msg-3"]);
    });
  });

  describe("removeBookmark", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(removeBookmark("bm-1")).rejects.toThrow("Unauthorized");
    });

    it("rejects removing non-existent or non-owned bookmark", async () => {
      mockBookmarksFindFirst.mockResolvedValueOnce(null);

      await expect(removeBookmark("bm-1")).rejects.toThrow("Bookmark not found");
    });

    it("removes owned bookmark", async () => {
      mockBookmarksFindFirst.mockResolvedValueOnce({ id: "bm-1", userId: "user-123" });
      mockDelete.mockReturnValue({
        where: () => Promise.resolve(),
      });

      const result = await removeBookmark("bm-1");

      expect(result).toEqual({ removed: true });
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});

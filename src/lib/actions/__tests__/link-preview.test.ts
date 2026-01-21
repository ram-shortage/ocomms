import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMessagePreviews } from "../link-preview";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
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

// Mock database
const mockFindFirst = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      messages: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      channelMembers: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      conversationParticipants: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

describe("Link Preview Actions (M-10 fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: "user-123" },
    });
  });

  describe("getMessagePreviews", () => {
    it("rejects unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(getMessagePreviews("msg-123")).rejects.toThrow("Unauthorized");
    });

    it("rejects when message not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null); // message not found

      await expect(getMessagePreviews("msg-123")).rejects.toThrow("Message not found");
    });

    it("rejects when user not a channel member", async () => {
      // Message in a channel
      mockFindFirst.mockResolvedValueOnce({ id: "msg-123", channelId: "ch-456", conversationId: null });
      // User not a member
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(getMessagePreviews("msg-123")).rejects.toThrow("Not authorized");
    });

    it("rejects when user not a conversation participant", async () => {
      // Message in a DM
      mockFindFirst.mockResolvedValueOnce({ id: "msg-123", channelId: null, conversationId: "conv-789" });
      // User not a participant
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(getMessagePreviews("msg-123")).rejects.toThrow("Not authorized");
    });

    it("returns previews for channel member", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "msg-123", channelId: "ch-456", conversationId: null })
        .mockResolvedValueOnce({ id: "member-1" }); // is member

      // Mock the select chain for previews
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { id: "preview-1", url: "https://example.com", title: "Example", description: null, imageUrl: null, siteName: "Example", position: 0, hidden: false },
        ]),
      };
      mockSelect.mockReturnValue(mockChain);

      const result = await getMessagePreviews("msg-123");

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Example");
    });

    it("returns previews for conversation participant", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "msg-123", channelId: null, conversationId: "conv-789" })
        .mockResolvedValueOnce({ id: "participant-1" }); // is participant

      // Mock the select chain for previews
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { id: "preview-1", url: "https://example.com", title: "Example Site", description: "A description", imageUrl: "https://example.com/img.png", siteName: "Example", position: 0, hidden: false },
        ]),
      };
      mockSelect.mockReturnValue(mockChain);

      const result = await getMessagePreviews("msg-123");

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Example Site");
      expect(result[0].description).toBe("A description");
    });

    it("returns empty array for message with no previews", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "msg-123", channelId: "ch-456", conversationId: null })
        .mockResolvedValueOnce({ id: "member-1" }); // is member

      // Mock the select chain returning empty
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockSelect.mockReturnValue(mockChain);

      const result = await getMessagePreviews("msg-123");

      expect(result).toHaveLength(0);
    });
  });
});

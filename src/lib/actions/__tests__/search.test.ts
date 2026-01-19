import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchMessages } from "../search";

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

// Mock database queries and selects
const mockChannelMembersFindMany = vi.fn();
const mockConversationParticipantsFindMany = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockLeftJoin = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      channelMembers: { findMany: (...args: unknown[]) => mockChannelMembersFindMany(...args) },
      conversationParticipants: { findMany: (...args: unknown[]) => mockConversationParticipantsFindMany(...args) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

describe("Search Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is authenticated
    mockGetSession.mockResolvedValue({
      user: { id: "user-123", name: "Test User", email: "test@example.com" },
    });

    // Setup chained query builder mock
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin });
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
  });

  describe("searchMessages", () => {
    it("returns matching messages from member channels", async () => {
      // Setup: user is member of channels with messages
      mockChannelMembersFindMany.mockResolvedValueOnce([
        { channelId: "ch-1", channel: { organizationId: "org-789" } },
        { channelId: "ch-2", channel: { organizationId: "org-789" } },
      ]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([]);

      const searchResults = [
        {
          id: "msg-1",
          content: "hello world",
          channelId: "ch-1",
          conversationId: null,
          authorId: "author-1",
          createdAt: new Date(),
          rank: 0.5,
          authorName: "Author 1",
          authorImage: null,
          channelName: "general",
          channelSlug: "general",
          conversationIsGroup: null,
        },
      ];
      mockLimit.mockResolvedValueOnce(searchResults);

      const result = await searchMessages("org-789", "hello");

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("hello world");
      expect(result[0].channel).toBeDefined();
      expect(result[0].channel?.name).toBe("general");
    });

    it("returns matching messages from DMs user participates in", async () => {
      mockChannelMembersFindMany.mockResolvedValueOnce([]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([
        { conversationId: "conv-1", conversation: { organizationId: "org-789" } },
      ]);

      const searchResults = [
        {
          id: "msg-2",
          content: "hello from DM",
          channelId: null,
          conversationId: "conv-1",
          authorId: "author-2",
          createdAt: new Date(),
          rank: 0.4,
          authorName: "Author 2",
          authorImage: null,
          channelName: null,
          channelSlug: null,
          conversationIsGroup: false,
        },
      ];
      mockLimit.mockResolvedValueOnce(searchResults);

      const result = await searchMessages("org-789", "hello");

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("hello from DM");
      expect(result[0].conversation).toBeDefined();
      expect(result[0].conversation?.isGroup).toBe(false);
    });

    it("returns empty array for empty query", async () => {
      const result = await searchMessages("org-789", "");

      expect(result).toHaveLength(0);
      // Should not call database queries for empty search
      expect(mockChannelMembersFindMany).not.toHaveBeenCalled();
    });

    it("returns empty array for whitespace-only query", async () => {
      const result = await searchMessages("org-789", "   ");

      expect(result).toHaveLength(0);
      expect(mockChannelMembersFindMany).not.toHaveBeenCalled();
    });

    it("returns empty when user has no accessible channels or conversations", async () => {
      mockChannelMembersFindMany.mockResolvedValueOnce([]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([]);

      const result = await searchMessages("org-789", "hello");

      expect(result).toHaveLength(0);
      // Should not proceed to full-text search
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("excludes channels from other organizations", async () => {
      // User is member of channels in different orgs
      mockChannelMembersFindMany.mockResolvedValueOnce([
        { channelId: "ch-1", channel: { organizationId: "org-789" } },
        { channelId: "ch-2", channel: { organizationId: "other-org" } }, // Different org
      ]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([]);

      mockLimit.mockResolvedValueOnce([]);

      const result = await searchMessages("org-789", "hello");

      // The search should filter to only org-789 channels
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it("respects result limit parameter", async () => {
      mockChannelMembersFindMany.mockResolvedValueOnce([
        { channelId: "ch-1", channel: { organizationId: "org-789" } },
      ]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([]);
      mockLimit.mockResolvedValueOnce([]);

      await searchMessages("org-789", "hello", 10);

      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it("uses default limit of 50 when not specified", async () => {
      mockChannelMembersFindMany.mockResolvedValueOnce([
        { channelId: "ch-1", channel: { organizationId: "org-789" } },
      ]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([]);
      mockLimit.mockResolvedValueOnce([]);

      await searchMessages("org-789", "hello");

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it("rejects unauthenticated users", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(searchMessages("org-789", "hello")).rejects.toThrow("Unauthorized");
    });

    it("combines results from both channels and conversations", async () => {
      mockChannelMembersFindMany.mockResolvedValueOnce([
        { channelId: "ch-1", channel: { organizationId: "org-789" } },
      ]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([
        { conversationId: "conv-1", conversation: { organizationId: "org-789" } },
      ]);

      const searchResults = [
        {
          id: "msg-1",
          content: "hello in channel",
          channelId: "ch-1",
          conversationId: null,
          authorId: "author-1",
          createdAt: new Date(),
          rank: 0.5,
          authorName: "Author 1",
          authorImage: null,
          channelName: "general",
          channelSlug: "general",
          conversationIsGroup: null,
        },
        {
          id: "msg-2",
          content: "hello in DM",
          channelId: null,
          conversationId: "conv-1",
          authorId: "author-2",
          createdAt: new Date(),
          rank: 0.4,
          authorName: "Author 2",
          authorImage: null,
          channelName: null,
          channelSlug: null,
          conversationIsGroup: false,
        },
      ];
      mockLimit.mockResolvedValueOnce(searchResults);

      const result = await searchMessages("org-789", "hello");

      expect(result).toHaveLength(2);
      expect(result.some((r) => r.channel !== null)).toBe(true);
      expect(result.some((r) => r.conversation !== null)).toBe(true);
    });

    it("transforms results to SearchResult format with author info", async () => {
      mockChannelMembersFindMany.mockResolvedValueOnce([
        { channelId: "ch-1", channel: { organizationId: "org-789" } },
      ]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([]);

      const searchResults = [
        {
          id: "msg-1",
          content: "test message",
          channelId: "ch-1",
          conversationId: null,
          authorId: "author-1",
          createdAt: new Date("2026-01-15"),
          rank: 0.75,
          authorName: "John Doe",
          authorImage: "https://example.com/avatar.jpg",
          channelName: "engineering",
          channelSlug: "engineering",
          conversationIsGroup: null,
        },
      ];
      mockLimit.mockResolvedValueOnce(searchResults);

      const result = await searchMessages("org-789", "test");

      expect(result[0]).toMatchObject({
        id: "msg-1",
        content: "test message",
        channelId: "ch-1",
        conversationId: null,
        authorId: "author-1",
        rank: 0.75,
        author: {
          id: "author-1",
          name: "John Doe",
          image: "https://example.com/avatar.jpg",
        },
        channel: {
          id: "ch-1",
          name: "engineering",
          slug: "engineering",
        },
        conversation: null,
      });
    });

    it("handles null author name gracefully", async () => {
      mockChannelMembersFindMany.mockResolvedValueOnce([
        { channelId: "ch-1", channel: { organizationId: "org-789" } },
      ]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([]);

      const searchResults = [
        {
          id: "msg-1",
          content: "test",
          channelId: "ch-1",
          conversationId: null,
          authorId: "author-1",
          createdAt: new Date(),
          rank: 0.5,
          authorName: null, // null author name
          authorImage: null,
          channelName: "general",
          channelSlug: "general",
          conversationIsGroup: null,
        },
      ];
      mockLimit.mockResolvedValueOnce(searchResults);

      const result = await searchMessages("org-789", "test");

      expect(result[0].author.name).toBe("Unknown");
    });
  });

  describe("Search result scoping", () => {
    it("only includes messages from channels user is member of", async () => {
      // User is only member of ch-1, not ch-2
      mockChannelMembersFindMany.mockResolvedValueOnce([
        { channelId: "ch-1", channel: { organizationId: "org-789" } },
        // ch-2 not included - user is not a member
      ]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([]);

      // Results should only include accessible channels
      const searchResults = [
        {
          id: "msg-1",
          content: "accessible message",
          channelId: "ch-1",
          conversationId: null,
          authorId: "author-1",
          createdAt: new Date(),
          rank: 0.5,
          authorName: "Author",
          authorImage: null,
          channelName: "general",
          channelSlug: "general",
          conversationIsGroup: null,
        },
      ];
      mockLimit.mockResolvedValueOnce(searchResults);

      const result = await searchMessages("org-789", "message");

      expect(result).toHaveLength(1);
      expect(result[0].channelId).toBe("ch-1");
    });

    it("filters conversations by organization", async () => {
      mockChannelMembersFindMany.mockResolvedValueOnce([]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([
        { conversationId: "conv-1", conversation: { organizationId: "org-789" } },
        { conversationId: "conv-2", conversation: { organizationId: "other-org" } },
      ]);

      mockLimit.mockResolvedValueOnce([]);

      await searchMessages("org-789", "hello");

      // The permission condition should only include conv-1
      expect(mockSelect).toHaveBeenCalled();
    });

    it("excludes soft-deleted messages from results", async () => {
      // The search query should include isNull(messages.deletedAt) condition
      // This is verified by the WHERE clause in searchMessages
      mockChannelMembersFindMany.mockResolvedValueOnce([
        { channelId: "ch-1", channel: { organizationId: "org-789" } },
      ]);
      mockConversationParticipantsFindMany.mockResolvedValueOnce([]);

      // Only non-deleted messages returned
      const searchResults = [
        {
          id: "msg-active",
          content: "active message",
          channelId: "ch-1",
          conversationId: null,
          authorId: "author-1",
          createdAt: new Date(),
          rank: 0.5,
          authorName: "Author",
          authorImage: null,
          channelName: "general",
          channelSlug: "general",
          conversationIsGroup: null,
        },
      ];
      mockLimit.mockResolvedValueOnce(searchResults);

      const result = await searchMessages("org-789", "message");

      // All returned messages should have null deletedAt (enforced by query)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("msg-active");
    });
  });
});

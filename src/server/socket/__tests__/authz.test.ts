import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isChannelMember,
  isConversationParticipant,
  isOrganizationMember,
  getMessageContext,
  getChannelOrganization,
  getConversationOrganization,
} from "../authz";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

// Get the mocked db
import { db } from "@/db";

// Type assertion for mock functions
const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

describe("Socket Authorization Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the chain
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
  });

  describe("isChannelMember", () => {
    it("returns true when user is member", async () => {
      mockDb.limit.mockResolvedValue([{ id: "membership-id" }]);

      const result = await isChannelMember("user-123", "channel-456");

      expect(result).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it("returns false when user is not member", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await isChannelMember("user-123", "channel-456");

      expect(result).toBe(false);
    });
  });

  describe("isConversationParticipant", () => {
    it("returns true when user is participant", async () => {
      mockDb.limit.mockResolvedValue([{ id: "participant-id" }]);

      const result = await isConversationParticipant("user-123", "conv-456");

      expect(result).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("returns false when user is not participant", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await isConversationParticipant("user-123", "conv-456");

      expect(result).toBe(false);
    });
  });

  describe("isOrganizationMember", () => {
    it("returns true when user is org member", async () => {
      mockDb.limit.mockResolvedValue([{ id: "member-id" }]);

      const result = await isOrganizationMember("user-123", "org-456");

      expect(result).toBe(true);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("returns false when user is not org member", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await isOrganizationMember("user-123", "org-456");

      expect(result).toBe(false);
    });
  });

  describe("getMessageContext", () => {
    it("returns channelId for channel message", async () => {
      mockDb.limit.mockResolvedValue([
        { channelId: "channel-123", conversationId: null },
      ]);

      const result = await getMessageContext("message-456");

      expect(result).toEqual({
        channelId: "channel-123",
        conversationId: null,
      });
    });

    it("returns conversationId for DM message", async () => {
      mockDb.limit.mockResolvedValue([
        { channelId: null, conversationId: "conv-123" },
      ]);

      const result = await getMessageContext("message-456");

      expect(result).toEqual({
        channelId: null,
        conversationId: "conv-123",
      });
    });

    it("returns null for non-existent message", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await getMessageContext("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("getChannelOrganization", () => {
    it("returns organizationId when channel exists", async () => {
      mockDb.limit.mockResolvedValue([{ organizationId: "org-123" }]);

      const result = await getChannelOrganization("channel-456");

      expect(result).toBe("org-123");
    });

    it("returns null when channel does not exist", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await getChannelOrganization("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("getConversationOrganization", () => {
    it("returns organizationId when conversation exists", async () => {
      mockDb.limit.mockResolvedValue([{ organizationId: "org-123" }]);

      const result = await getConversationOrganization("conv-456");

      expect(result).toBe("org-123");
    });

    it("returns null when conversation does not exist", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await getConversationOrganization("non-existent-id");

      expect(result).toBeNull();
    });
  });
});

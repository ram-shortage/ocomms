import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createChannel,
  getChannel,
  getChannels,
  joinChannel,
  leaveChannel,
  updateChannelTopic,
  updateChannelDescription,
} from "../channel";

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

// Mock database
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      members: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      channels: { findFirst: (...args: unknown[]) => mockFindFirst(...args), findMany: (...args: unknown[]) => mockFindMany(...args) },
      channelMembers: { findFirst: (...args: unknown[]) => mockFindFirst(...args), findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

describe("Channel Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is authenticated
    mockGetSession.mockResolvedValue({
      user: { id: "user-123", name: "Test User", email: "test@example.com" },
    });
  });

  describe("createChannel", () => {
    it("creates channel with creator as admin", async () => {
      // Setup: user is org member
      mockFindFirst.mockResolvedValueOnce({ id: "member-id" }); // org membership check

      const newChannel = { id: "channel-456", name: "general", slug: "general" };
      mockTransaction.mockImplementation(async (cb) => {
        return cb({
          insert: () => ({
            values: () => ({
              returning: () => Promise.resolve([newChannel]),
            }),
          }),
        });
      });

      const result = await createChannel({
        organizationId: "org-789",
        name: "general",
        description: "General discussion",
      });

      expect(result).toEqual(newChannel);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it("rejects non-org member", async () => {
      // Setup: user is NOT org member
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(
        createChannel({
          organizationId: "org-789",
          name: "general",
        })
      ).rejects.toThrow("Not authorized to create channels in this organization");
    });

    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        createChannel({
          organizationId: "org-789",
          name: "general",
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("supports private channel creation", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-id" });

      const newChannel = { id: "channel-456", name: "secret", slug: "secret", isPrivate: true };
      mockTransaction.mockImplementation(async (cb) => {
        return cb({
          insert: () => ({
            values: () => ({
              returning: () => Promise.resolve([newChannel]),
            }),
          }),
        });
      });

      const result = await createChannel({
        organizationId: "org-789",
        name: "secret",
        isPrivate: true,
      });

      expect(result.isPrivate).toBe(true);
    });
  });

  describe("getChannel", () => {
    it("returns channel for org member", async () => {
      // Setup: user is org member and channel exists
      mockFindFirst
        .mockResolvedValueOnce({ id: "member-id" }) // org membership
        .mockResolvedValueOnce({
          id: "channel-456",
          name: "general",
          slug: "general",
          isPrivate: false,
          members: [{ userId: "user-123" }],
        });

      const result = await getChannel("org-789", "general");

      expect(result).toBeDefined();
      expect(result?.name).toBe("general");
    });

    it("returns null for non-org member", async () => {
      // Setup: user is NOT org member
      mockFindFirst.mockResolvedValueOnce(null);

      const result = await getChannel("org-789", "general");

      expect(result).toBeNull();
    });

    it("returns null for private channel non-member", async () => {
      // Setup: user is org member but not channel member
      mockFindFirst
        .mockResolvedValueOnce({ id: "member-id" }) // org membership
        .mockResolvedValueOnce({
          id: "channel-456",
          name: "secret",
          slug: "secret",
          isPrivate: true,
          members: [{ userId: "other-user" }], // user-123 not in members
        });

      const result = await getChannel("org-789", "secret");

      expect(result).toBeNull();
    });

    it("returns private channel for member", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "member-id" }) // org membership
        .mockResolvedValueOnce({
          id: "channel-456",
          name: "secret",
          slug: "secret",
          isPrivate: true,
          members: [{ userId: "user-123" }], // user IS member
        });

      const result = await getChannel("org-789", "secret");

      expect(result).toBeDefined();
      expect(result?.name).toBe("secret");
    });
  });

  describe("getChannels", () => {
    it("returns public channels for org member", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-id" });
      mockFindMany.mockResolvedValueOnce([
        { id: "ch-1", name: "general", isPrivate: false, members: [] },
        { id: "ch-2", name: "random", isPrivate: false, members: [] },
      ]);

      const result = await getChannels("org-789");

      expect(result).toHaveLength(2);
    });

    it("includes private channels user is member of", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-id" });
      mockFindMany.mockResolvedValueOnce([
        { id: "ch-1", name: "general", isPrivate: false, members: [] },
        { id: "ch-2", name: "secret", isPrivate: true, members: [{ userId: "user-123" }] },
      ]);

      const result = await getChannels("org-789");

      expect(result).toHaveLength(2);
      expect(result.find((c) => c.name === "secret")).toBeDefined();
    });

    it("excludes private channels user is not member of", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-id" });
      mockFindMany.mockResolvedValueOnce([
        { id: "ch-1", name: "general", isPrivate: false, members: [] },
        { id: "ch-2", name: "secret", isPrivate: true, members: [{ userId: "other-user" }] },
      ]);

      const result = await getChannels("org-789");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("general");
    });

    it("rejects non-org member", async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(getChannels("org-789")).rejects.toThrow(
        "Not authorized to view channels in this organization"
      );
    });
  });

  describe("joinChannel", () => {
    it("adds user as member to public channel", async () => {
      // Channel exists, is public, user is org member
      mockFindFirst
        .mockResolvedValueOnce({ id: "ch-1", organizationId: "org-789", isPrivate: false }) // channel
        .mockResolvedValueOnce({ id: "member-id" }); // org membership

      mockInsert.mockReturnValue({
        values: () => ({
          onConflictDoNothing: () => Promise.resolve(),
        }),
      });

      const result = await joinChannel("ch-1");

      expect(result).toEqual({ success: true });
      expect(mockInsert).toHaveBeenCalled();
    });

    it("rejects join for private channel", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "ch-1", isPrivate: true });

      await expect(joinChannel("ch-1")).rejects.toThrow(
        "Cannot join private channel directly"
      );
    });

    it("rejects if channel not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(joinChannel("non-existent")).rejects.toThrow("Channel not found");
    });

    it("rejects non-org member", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "ch-1", organizationId: "org-789", isPrivate: false })
        .mockResolvedValueOnce(null); // not org member

      await expect(joinChannel("ch-1")).rejects.toThrow(
        "Not authorized to join channels in this organization"
      );
    });
  });

  describe("leaveChannel", () => {
    it("removes membership", async () => {
      // User is member but not only admin
      mockFindMany.mockResolvedValueOnce([
        { userId: "user-123", role: "member" },
        { userId: "admin-user", role: "admin" },
      ]);

      mockDelete.mockReturnValue({
        where: () => Promise.resolve(),
      });

      const result = await leaveChannel("ch-1");

      expect(result).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalled();
    });

    it("prevents last admin from leaving with other members", async () => {
      // User is only admin, but there are other members
      mockFindMany.mockResolvedValueOnce([
        { userId: "user-123", role: "admin" },
        { userId: "other-user", role: "member" },
      ]);

      await expect(leaveChannel("ch-1")).rejects.toThrow(
        "Cannot leave: you are the only admin"
      );
    });

    it("allows last admin to leave if only member", async () => {
      // User is only admin AND only member
      mockFindMany.mockResolvedValueOnce([
        { userId: "user-123", role: "admin" },
      ]);

      mockDelete.mockReturnValue({
        where: () => Promise.resolve(),
      });

      const result = await leaveChannel("ch-1");

      expect(result).toEqual({ success: true });
    });
  });

  describe("updateChannelTopic", () => {
    it("updates topic for channel member", async () => {
      mockFindFirst.mockResolvedValueOnce({ userId: "user-123", role: "member" });
      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      });

      const result = await updateChannelTopic("ch-1", "New topic");

      expect(result).toEqual({ success: true });
    });

    it("rejects non-member", async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(updateChannelTopic("ch-1", "New topic")).rejects.toThrow(
        "Not a channel member"
      );
    });
  });

  describe("updateChannelDescription", () => {
    it("updates description for admin", async () => {
      mockFindFirst.mockResolvedValueOnce({ userId: "user-123", role: "admin" });
      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      });

      const result = await updateChannelDescription("ch-1", "New description");

      expect(result).toEqual({ success: true });
    });

    it("rejects non-admin member", async () => {
      mockFindFirst.mockResolvedValueOnce({ userId: "user-123", role: "member" });

      await expect(
        updateChannelDescription("ch-1", "New description")
      ).rejects.toThrow("Only channel admins can update description");
    });
  });
});

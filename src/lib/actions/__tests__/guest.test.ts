import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGuestInvite,
  redeemGuestInvite,
  removeGuestAccess,
  extendGuestExpiration,
  getGuestChannelAccess,
  getWorkspaceGuests,
  getGuestInvites,
  verifyGuestChannelAccess,
  revokeGuestInvite,
  isGuestSoftLocked,
} from "../guest";

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
      members: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
      guestInvites: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
      guestChannelAccess: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
      channels: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// Mock guest expiration queue
vi.mock("@/server/queue/guest-expiration.queue", () => ({
  guestExpirationQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
    getJob: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

describe("Guest Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: "user-123", name: "Test User", email: "test@example.com" },
    });
  });

  describe("createGuestInvite (GUST-01, GUST-02, GUST-08)", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        createGuestInvite("org-1", ["ch-1"])
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects non-admin user", async () => {
      // User is member but not admin
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "member" });

      await expect(
        createGuestInvite("org-1", ["ch-1"])
      ).rejects.toThrow("Only admins can create guest invites");
    });

    it("requires at least one channel", async () => {
      // User is admin
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

      await expect(
        createGuestInvite("org-1", [])
      ).rejects.toThrow("At least one channel must be specified");
    });

    it("validates channels belong to organization", async () => {
      // User is admin
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });
      // Channels query returns fewer than requested (invalid channel)
      mockFindMany.mockResolvedValueOnce([{ id: "ch-1" }]); // Only 1 of 2 valid

      await expect(
        createGuestInvite("org-1", ["ch-1", "invalid-ch"])
      ).rejects.toThrow("One or more channels are invalid");
    });

    it("creates invite for admin with valid channels", async () => {
      // User is admin
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });
      // All channels valid
      mockFindMany.mockResolvedValueOnce([{ id: "ch-1" }, { id: "ch-2" }]);
      // Insert returns invite
      mockInsert.mockReturnValue({
        values: () => ({
          returning: () => Promise.resolve([{
            id: "invite-1",
            token: "test-token-abc123",
            expiresAt: null,
          }]),
        }),
      });

      const result = await createGuestInvite("org-1", ["ch-1", "ch-2"]);

      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("inviteUrl");
      expect(result.channelIds).toEqual(["ch-1", "ch-2"]);
    });

    it("accepts owner role as admin", async () => {
      // User is owner (should also have admin access)
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "owner" });
      mockFindMany.mockResolvedValueOnce([{ id: "ch-1" }]);
      mockInsert.mockReturnValue({
        values: () => ({
          returning: () => Promise.resolve([{
            id: "invite-1",
            token: "test-token",
            expiresAt: null,
          }]),
        }),
      });

      const result = await createGuestInvite("org-1", ["ch-1"]);

      expect(result).toHaveProperty("token");
    });

    it("supports expiration date", async () => {
      const expiresAt = new Date(Date.now() + 86400000); // 1 day from now

      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });
      mockFindMany.mockResolvedValueOnce([{ id: "ch-1" }]);
      mockInsert.mockReturnValue({
        values: () => ({
          returning: () => Promise.resolve([{
            id: "invite-1",
            token: "test-token",
            expiresAt,
          }]),
        }),
      });

      const result = await createGuestInvite("org-1", ["ch-1"], expiresAt);

      expect(result.expiresAt).toEqual(expiresAt);
    });
  });

  describe("redeemGuestInvite", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        redeemGuestInvite("valid-token")
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects invalid token", async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(
        redeemGuestInvite("invalid-token")
      ).rejects.toThrow("Invalid invite link");
    });

    it("rejects already-used invite", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "invite-1",
        usedBy: "other-user",
      });

      await expect(
        redeemGuestInvite("used-token")
      ).rejects.toThrow("already been used");
    });

    it("rejects expired invite", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "invite-1",
        expiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
        usedBy: null,
      });

      await expect(
        redeemGuestInvite("expired-token")
      ).rejects.toThrow("expired");
    });

    it("rejects if user already a member", async () => {
      mockFindFirst
        .mockResolvedValueOnce({
          id: "invite-1",
          organizationId: "org-1",
          expiresAt: null,
          usedBy: null,
          organization: { slug: "test-org" },
        })
        .mockResolvedValueOnce({ id: "existing-member" }); // Already a member

      await expect(
        redeemGuestInvite("valid-token")
      ).rejects.toThrow("already a member");
    });

    it("creates guest membership from valid invite", async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockFindFirst
        .mockResolvedValueOnce({
          id: "invite-1",
          organizationId: "org-1",
          channelIds: JSON.stringify(["ch-1", "ch-2"]),
          expiresAt: futureDate,
          usedBy: null,
          organization: { slug: "test-org" },
        })
        .mockResolvedValueOnce(null); // Not already a member

      mockTransaction.mockImplementation(async (cb) => {
        return cb({
          insert: () => ({
            values: () => Promise.resolve(),
          }),
          update: () => ({
            set: () => ({
              where: () => Promise.resolve(),
            }),
          }),
        });
      });

      const result = await redeemGuestInvite("valid-token");

      expect(result.success).toBe(true);
      expect(result.organizationSlug).toBe("test-org");
    });
  });

  describe("getGuestChannelAccess", () => {
    it("returns channels for guest", async () => {
      mockFindMany.mockResolvedValueOnce([
        { channel: { id: "ch-1", name: "General", slug: "general" } },
        { channel: { id: "ch-2", name: "Support", slug: "support" } },
      ]);

      const result = await getGuestChannelAccess("member-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id", "ch-1");
      expect(result[1]).toHaveProperty("name", "Support");
    });

    it("returns empty array for guest with no access", async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const result = await getGuestChannelAccess("member-1");

      expect(result).toEqual([]);
    });
  });

  describe("verifyGuestChannelAccess", () => {
    it("returns true when guest has access", async () => {
      mockFindFirst.mockResolvedValueOnce({ memberId: "member-1", channelId: "ch-1" });

      const result = await verifyGuestChannelAccess("member-1", "ch-1");

      expect(result).toBe(true);
    });

    it("returns false when guest lacks access", async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      const result = await verifyGuestChannelAccess("member-1", "ch-1");

      expect(result).toBe(false);
    });
  });

  describe("removeGuestAccess (GUST-05)", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        removeGuestAccess("member-1")
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects non-existent member", async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(
        removeGuestAccess("non-existent")
      ).rejects.toThrow("Guest not found");
    });

    it("rejects removing non-guest member", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "member-1",
        isGuest: false,
      });

      await expect(
        removeGuestAccess("member-1")
      ).rejects.toThrow("not a guest");
    });

    it("rejects non-admin removal", async () => {
      mockFindFirst
        .mockResolvedValueOnce({
          id: "guest-member",
          isGuest: true,
          organizationId: "org-1",
        })
        .mockResolvedValueOnce({ id: "requester", role: "member" }); // Not admin

      await expect(
        removeGuestAccess("guest-member")
      ).rejects.toThrow("Only admins can remove");
    });

    it("removes guest for admin", async () => {
      mockFindFirst
        .mockResolvedValueOnce({
          id: "guest-member",
          isGuest: true,
          organizationId: "org-1",
          guestJobId: "job-123",
        })
        .mockResolvedValueOnce({ id: "admin-member", role: "admin" });

      mockTransaction.mockImplementation(async (cb) => {
        return cb({
          delete: () => ({
            where: () => Promise.resolve(),
          }),
        });
      });

      const result = await removeGuestAccess("guest-member");

      expect(result).toEqual({ success: true });
    });
  });

  describe("extendGuestExpiration", () => {
    it("rejects unauthenticated user", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(
        extendGuestExpiration("member-1", new Date())
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects non-guest member", async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: "member-1",
        isGuest: false,
      });

      await expect(
        extendGuestExpiration("member-1", new Date())
      ).rejects.toThrow("not a guest");
    });

    it("extends expiration for admin", async () => {
      const newExpiration = new Date(Date.now() + 86400000 * 30); // 30 days
      mockFindFirst
        .mockResolvedValueOnce({
          id: "guest-member",
          isGuest: true,
          organizationId: "org-1",
          guestJobId: "old-job",
        })
        .mockResolvedValueOnce({ id: "admin-member", role: "admin" });

      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      });

      const result = await extendGuestExpiration("guest-member", newExpiration);

      expect(result.success).toBe(true);
      expect(result.newExpiresAt).toEqual(newExpiration);
    });

    it("clears expiration when null passed", async () => {
      mockFindFirst
        .mockResolvedValueOnce({
          id: "guest-member",
          isGuest: true,
          organizationId: "org-1",
          guestJobId: "old-job",
        })
        .mockResolvedValueOnce({ id: "admin-member", role: "admin" });

      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      });

      const result = await extendGuestExpiration("guest-member", null);

      expect(result.success).toBe(true);
      expect(result.newExpiresAt).toBeNull();
    });
  });

  describe("getWorkspaceGuests", () => {
    it("rejects non-admin", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "member" });

      await expect(
        getWorkspaceGuests("org-1")
      ).rejects.toThrow("Only admins can view");
    });

    it("returns guests for admin", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });
      mockFindMany
        .mockResolvedValueOnce([
          {
            id: "guest-1",
            user: { id: "user-1", name: "Guest One", email: "guest@example.com" },
            createdAt: new Date(),
            guestExpiresAt: null,
            guestSoftLocked: false,
          },
        ])
        .mockResolvedValueOnce([]); // Channel access query

      const result = await getWorkspaceGuests("org-1");

      expect(result).toHaveLength(1);
      expect(result[0].user.name).toBe("Guest One");
    });
  });

  describe("getGuestInvites", () => {
    it("rejects non-admin", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "member" });

      await expect(
        getGuestInvites("org-1")
      ).rejects.toThrow("Only admins can view guest invites");
    });

    it("returns invites for admin", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });
      mockFindMany.mockResolvedValueOnce([
        {
          id: "invite-1",
          token: "abc123",
          channelIds: JSON.stringify(["ch-1"]),
          expiresAt: null,
          createdAt: new Date(),
          creator: { id: "user-1", name: "Admin", email: "admin@test.com" },
          usedBy: null,
          usedAt: null,
          usedByUser: null,
        },
      ]);

      const result = await getGuestInvites("org-1");

      expect(result).toHaveLength(1);
      expect(result[0].token).toBe("abc123");
      expect(result[0].isUsed).toBe(false);
    });
  });

  describe("revokeGuestInvite", () => {
    it("rejects non-admin", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "invite-1", organizationId: "org-1", usedBy: null })
        .mockResolvedValueOnce({ id: "member-1", role: "member" });

      await expect(
        revokeGuestInvite("invite-1")
      ).rejects.toThrow("Only admins can revoke");
    });

    it("rejects revoking used invite", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "invite-1", organizationId: "org-1", usedBy: "user-123" })
        .mockResolvedValueOnce({ id: "member-1", role: "admin" });

      await expect(
        revokeGuestInvite("invite-1")
      ).rejects.toThrow("Cannot revoke an already-used invite");
    });

    it("revokes unused invite for admin", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "invite-1", organizationId: "org-1", usedBy: null })
        .mockResolvedValueOnce({ id: "member-1", role: "admin" });

      mockDelete.mockReturnValue({
        where: () => Promise.resolve(),
      });

      const result = await revokeGuestInvite("invite-1");

      expect(result).toEqual({ success: true });
    });
  });

  describe("isGuestSoftLocked", () => {
    it("returns true when guest is soft-locked", async () => {
      mockFindFirst.mockResolvedValueOnce({ guestSoftLocked: true });

      const result = await isGuestSoftLocked("member-1");

      expect(result).toBe(true);
    });

    it("returns false when guest is not soft-locked", async () => {
      mockFindFirst.mockResolvedValueOnce({ guestSoftLocked: false });

      const result = await isGuestSoftLocked("member-1");

      expect(result).toBe(false);
    });

    it("returns false for non-existent member", async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      const result = await isGuestSoftLocked("non-existent");

      expect(result).toBe(false);
    });
  });
});

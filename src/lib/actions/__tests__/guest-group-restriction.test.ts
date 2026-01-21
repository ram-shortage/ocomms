import { describe, it, expect, vi, beforeEach } from "vitest";
import { addGroupMember, getGroupMembers } from "../user-group";

/**
 * Integration test for GUST-07: Guests cannot be added to user groups
 * This validates the cross-feature interaction between guest access and user groups
 * Required by TEST-02 specification
 */

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
const mockFindMany = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      userGroups: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      userGroupMembers: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
      members: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

describe("Guest-Group Restriction (GUST-07, TEST-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: "admin-123", name: "Admin User", email: "admin@example.com" },
    });
  });

  describe("addGroupMember - guest restriction", () => {
    it("prevents adding guest to user group (GUST-07 core requirement)", async () => {
      // Setup: Group exists, requester is admin, target user is a guest
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" }) // group exists
        .mockResolvedValueOnce({ id: "admin-member", role: "admin" }) // requester is admin
        .mockResolvedValueOnce({ id: "guest-member", userId: "guest-user", isGuest: true }); // target is guest

      await expect(
        addGroupMember("group-1", "guest-user")
      ).rejects.toThrow("Guests cannot be added to user groups");
    });

    it("allows adding regular member to user group", async () => {
      // Setup: Group exists, requester is admin, target is regular member
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" }) // group exists
        .mockResolvedValueOnce({ id: "admin-member", role: "admin" }) // requester is admin
        .mockResolvedValueOnce({ id: "regular-member", userId: "regular-user", isGuest: false }) // not a guest
        .mockResolvedValueOnce(null); // not already in group

      mockInsert.mockReturnValue({
        values: () => Promise.resolve(),
      });

      const result = await addGroupMember("group-1", "regular-user");

      expect(result).toEqual({ success: true });
      expect(mockInsert).toHaveBeenCalled();
    });

    it("rejects when group does not exist", async () => {
      mockFindFirst.mockResolvedValueOnce(null); // group not found

      await expect(
        addGroupMember("nonexistent-group", "user-123")
      ).rejects.toThrow("Group not found");
    });

    it("rejects when requester is not admin", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" }) // group exists
        .mockResolvedValueOnce({ id: "member", role: "member" }); // requester is not admin

      await expect(
        addGroupMember("group-1", "user-123")
      ).rejects.toThrow("Only admins can add group members");
    });

    it("rejects when target user is not a workspace member", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" }) // group exists
        .mockResolvedValueOnce({ id: "admin-member", role: "admin" }) // requester is admin
        .mockResolvedValueOnce(null); // target is not a workspace member

      await expect(
        addGroupMember("group-1", "non-member-user")
      ).rejects.toThrow("User is not a member of this workspace");
    });

    it("rejects when user is already a group member", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" }) // group exists
        .mockResolvedValueOnce({ id: "admin-member", role: "admin" }) // requester is admin
        .mockResolvedValueOnce({ id: "existing-member", userId: "user-123", isGuest: false }) // regular member
        .mockResolvedValueOnce({ groupId: "group-1", userId: "user-123" }); // already in group

      await expect(
        addGroupMember("group-1", "user-123")
      ).rejects.toThrow("User is already a member of this group");
    });
  });

  describe("getGroupMembers - guest visibility", () => {
    it("allows workspace members to view group members", async () => {
      // Setup: Group exists, requester is a workspace member (not admin)
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" }) // group exists
        .mockResolvedValueOnce({ id: "member", role: "member", organizationId: "org-1" }); // requester is workspace member

      mockFindMany.mockResolvedValueOnce([
        { userId: "user-1", user: { name: "User One", email: "user1@example.com", image: null } },
        { userId: "user-2", user: { name: "User Two", email: "user2@example.com", image: null } },
      ]);

      const result = await getGroupMembers("group-1");

      expect(result).toHaveLength(2);
      // Non-admin should not see email addresses (privacy)
      expect(result[0].email).toBeUndefined();
    });

    it("allows admin to see member emails", async () => {
      // Setup: Requester is admin
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "admin-member", role: "admin", organizationId: "org-1" });

      mockFindMany.mockResolvedValueOnce([
        { userId: "user-1", user: { name: "User One", email: "user1@example.com", image: null } },
      ]);

      const result = await getGroupMembers("group-1");

      expect(result).toHaveLength(1);
      // Admin should see email addresses
      expect(result[0].email).toBe("user1@example.com");
    });

    it("rejects non-workspace member from viewing groups", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" }) // group exists
        .mockResolvedValueOnce(null); // requester is not in workspace

      await expect(
        getGroupMembers("group-1")
      ).rejects.toThrow("Not authorized to view members of this group");
    });
  });

  describe("Guest integration scenarios", () => {
    it("guest user cannot be added to any group in workspace", async () => {
      // This is the key GUST-07 test case: even if admin tries,
      // guest users must be rejected from group membership

      mockFindFirst
        .mockResolvedValueOnce({ id: "engineering-group", organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "admin-member", role: "owner" }) // even owner can't override
        .mockResolvedValueOnce({ id: "guest-member", userId: "guest-user", isGuest: true });

      await expect(
        addGroupMember("engineering-group", "guest-user")
      ).rejects.toThrow("Guests cannot be added to user groups");
    });

    it("converts isGuest=undefined to allowed (backwards compatibility)", async () => {
      // Members created before guest feature might not have isGuest set
      // They should be treated as regular members (falsy isGuest)

      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "admin-member", role: "admin" })
        .mockResolvedValueOnce({ id: "old-member", userId: "old-user", isGuest: undefined }) // no isGuest field
        .mockResolvedValueOnce(null); // not in group yet

      mockInsert.mockReturnValue({
        values: () => Promise.resolve(),
      });

      const result = await addGroupMember("group-1", "old-user");

      expect(result).toEqual({ success: true });
    });

    it("converts isGuest=false to allowed", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-1", organizationId: "org-1" })
        .mockResolvedValueOnce({ id: "admin-member", role: "admin" })
        .mockResolvedValueOnce({ id: "regular-member", userId: "regular-user", isGuest: false })
        .mockResolvedValueOnce(null);

      mockInsert.mockReturnValue({
        values: () => Promise.resolve(),
      });

      const result = await addGroupMember("group-1", "regular-user");

      expect(result).toEqual({ success: true });
    });
  });
});

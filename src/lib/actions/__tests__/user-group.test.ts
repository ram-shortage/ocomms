import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGroupMembers, getGroupByHandle } from "../user-group";

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

vi.mock("@/db", () => ({
  db: {
    query: {
      userGroups: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      userGroupMembers: { findMany: (...args: unknown[]) => mockFindMany(...args) },
      members: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    },
  },
}));

describe("User Group Actions (M-9 and L-4 fixes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: "user-123" },
    });
  });

  describe("getGroupMembers (M-9)", () => {
    it("rejects unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(getGroupMembers("group-123")).rejects.toThrow("Unauthorized");
    });

    it("rejects when group not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null); // group not found

      await expect(getGroupMembers("group-123")).rejects.toThrow("Group not found");
    });

    it("rejects when requester not in group organization", async () => {
      // Group exists
      mockFindFirst.mockResolvedValueOnce({ id: "group-123", organizationId: "org-456" });
      // But requester is not a member
      mockFindFirst.mockResolvedValueOnce(null);

      await expect(getGroupMembers("group-123")).rejects.toThrow("Not authorized");
    });

    it("returns members when requester is in organization", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-123", organizationId: "org-456" }) // group
        .mockResolvedValueOnce({ id: "member-1", role: "member" }); // org membership
      mockFindMany.mockResolvedValueOnce([
        { userId: "user-1", user: { name: "Alice", email: "alice@example.com", image: null } },
        { userId: "user-2", user: { name: "Bob", email: "bob@example.com", image: null } },
      ]);

      const result = await getGroupMembers("group-123");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Alice");
    });

    it("hides email for non-admin users", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-123", organizationId: "org-456" }) // group
        .mockResolvedValueOnce({ id: "member-1", role: "member" }); // org membership (not admin)
      mockFindMany.mockResolvedValueOnce([
        { userId: "user-1", user: { name: "Alice", email: "alice@example.com", image: null } },
      ]);

      const result = await getGroupMembers("group-123");

      expect(result[0].email).toBeUndefined();
    });

    it("shows email for admin users", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "group-123", organizationId: "org-456" }) // group
        .mockResolvedValueOnce({ id: "member-1", role: "admin" }); // org membership (admin)
      mockFindMany.mockResolvedValueOnce([
        { userId: "user-1", user: { name: "Alice", email: "alice@example.com", image: null } },
      ]);

      const result = await getGroupMembers("group-123");

      expect(result[0].email).toBe("alice@example.com");
    });
  });

  describe("getGroupByHandle (L-4)", () => {
    it("rejects unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(getGroupByHandle("org-123", "designers")).rejects.toThrow("Unauthorized");
    });

    it("verifies organization membership", async () => {
      mockFindFirst.mockResolvedValueOnce(null); // not a member

      await expect(getGroupByHandle("org-123", "designers")).rejects.toThrow("Not authorized");
    });

    it("returns null when group not found", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "member-1" }) // org membership
        .mockResolvedValueOnce(null); // group not found

      const result = await getGroupByHandle("org-123", "designers");

      expect(result).toBeNull();
    });

    it("returns group when authorized", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "member-1" }) // org membership
        .mockResolvedValueOnce({
          id: "group-1",
          handle: "designers",
          name: "Designers",
          members: [{ userId: "user-1" }, { userId: "user-2" }],
        }); // group

      const result = await getGroupByHandle("org-123", "designers");

      expect(result).toBeDefined();
      expect(result?.handle).toBe("designers");
      expect(result?.memberCount).toBe(2);
    });

    it("normalizes handle before lookup", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: "member-1" }) // org membership
        .mockResolvedValueOnce({
          id: "group-1",
          handle: "designers",
          name: "Designers",
          members: [],
        }); // group

      // Pass uppercase handle
      const result = await getGroupByHandle("org-123", "DESIGNERS");

      expect(result).toBeDefined();
      expect(result?.handle).toBe("designers");
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserStatus, setUserStatus, clearUserStatus } from "../user-status";

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

// Mock status expiration queue
vi.mock("@/server/queue/status-expiration.queue", () => ({
  statusExpirationQueue: {
    getJob: vi.fn().mockResolvedValue(null),
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
  },
}));

// Mock database
const mockFindFirst = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      userStatuses: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
      members: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    },
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe("User Status Actions (M-8 fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: "user-123", name: "Test User" },
    });
  });

  describe("getUserStatus", () => {
    it("rejects unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(getUserStatus("other-user-id", "org-123")).rejects.toThrow("Unauthorized");
    });

    it("allows self-lookup without organization context", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "status-1", emoji: "😀", text: "Working" });

      const result = await getUserStatus("user-123");

      expect(result).toBeDefined();
      expect(result?.emoji).toBe("😀");
    });

    it("rejects cross-user lookup without organization context", async () => {
      await expect(getUserStatus("other-user-id")).rejects.toThrow(
        "Organization context required"
      );
    });

    it("verifies organization membership for cross-user lookup", async () => {
      // Mock: requester is NOT in the organization
      mockFindFirst.mockResolvedValueOnce(null); // org membership check fails

      await expect(getUserStatus("other-user-id", "org-123")).rejects.toThrow(
        "Not authorized"
      );
    });

    it("returns null when target user is not in the same organization", async () => {
      // Mock: requester is in org
      mockFindFirst
        .mockResolvedValueOnce({ id: "member-1" }) // requester org membership
        .mockResolvedValueOnce(null); // target NOT in org

      const result = await getUserStatus("other-user-id", "org-123");

      expect(result).toBeNull();
    });

    it("returns status when requester and target share organization", async () => {
      // Mock: requester is in org, target is in org, status exists
      mockFindFirst
        .mockResolvedValueOnce({ id: "member-1" }) // requester org membership
        .mockResolvedValueOnce({ id: "member-2" }) // target org membership
        .mockResolvedValueOnce({ id: "status-1", emoji: "🎉", text: "Celebrating" }); // status

      const result = await getUserStatus("other-user-id", "org-123");

      expect(result).toBeDefined();
      expect(result?.emoji).toBe("🎉");
    });
  });

  describe("setUserStatus", () => {
    it("rejects unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(setUserStatus({ emoji: "😀", text: "test" })).rejects.toThrow("Unauthorized");
    });

    it("rejects status text over 100 characters", async () => {
      const longText = "a".repeat(101);

      await expect(setUserStatus({ emoji: "😀", text: longText })).rejects.toThrow(
        "Status text must be 100 characters or less"
      );
    });

    it("creates status for authenticated user (no existing)", async () => {
      mockFindFirst.mockResolvedValueOnce(null); // no existing status
      mockInsert.mockReturnValue({
        values: () => ({
          returning: () => Promise.resolve([{ id: "status-1", emoji: "😀", text: "test" }]),
        }),
      });

      const result = await setUserStatus({ emoji: "😀", text: "test", dndEnabled: false });

      expect(result).toBeDefined();
      expect(mockInsert).toHaveBeenCalled();
    });

    it("updates existing status for authenticated user", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "status-1", emoji: "😊", jobId: null }); // existing status
      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: "status-1", emoji: "😀", text: "updated" }]),
          }),
        }),
      });

      const result = await setUserStatus({ emoji: "😀", text: "updated" });

      expect(result).toBeDefined();
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe("clearUserStatus", () => {
    it("rejects unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(clearUserStatus()).rejects.toThrow("Unauthorized");
    });

    it("returns cleared: true when no existing status", async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      const result = await clearUserStatus();

      expect(result).toEqual({ cleared: true });
    });

    it("deletes existing status for authenticated user", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "status-1", emoji: "😀", jobId: null });
      mockDelete.mockReturnValue({
        where: () => Promise.resolve(),
      });

      const result = await clearUserStatus();

      expect(result).toEqual({ cleared: true });
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});

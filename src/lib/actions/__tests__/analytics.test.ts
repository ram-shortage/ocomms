import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMessageVolume,
  getActiveUsers,
  getChannelActivity,
  getPeakUsageTimes,
  getStorageUsage,
} from "../analytics";

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

// Mock database - simplified to focus on authorization tests
const mockFindFirst = vi.fn();

// Create a complete chainable mock for Drizzle select API
function createSelectMock(result: unknown = []) {
  // Create a thenable that returns the result
  const makeThenable = (data: unknown) => ({
    then: (resolve: (v: unknown) => void) => resolve(data),
  });

  // Create terminal chain that returns result
  const terminal = {
    ...makeThenable(result),
    limit: vi.fn().mockReturnValue(makeThenable(result)),
    orderBy: vi.fn().mockReturnValue({
      ...makeThenable(result),
      limit: vi.fn().mockReturnValue(makeThenable(result)),
    }),
    groupBy: vi.fn().mockReturnValue({
      ...makeThenable(result),
      orderBy: vi.fn().mockReturnValue({
        ...makeThenable(result),
        limit: vi.fn().mockReturnValue(makeThenable(result)),
      }),
      limit: vi.fn().mockReturnValue(makeThenable(result)),
    }),
  };

  const chain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(terminal),
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(makeThenable(result)),
            }),
          }),
        }),
      }),
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue(makeThenable(result)),
        }),
      }),
    }),
  };

  return chain;
}

vi.mock("@/db", () => ({
  db: {
    query: {
      members: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    },
    select: () => createSelectMock([]),
  },
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    as: () => ({}),
  })),
}));

describe("Analytics Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: "user-123", name: "Test User", email: "test@example.com" },
    });
  });

  describe("Authorization (all analytics endpoints)", () => {
    describe("getMessageVolume", () => {
      it("rejects unauthenticated user", async () => {
        mockGetSession.mockResolvedValue(null);

        await expect(
          getMessageVolume("org-1", new Date(), new Date())
        ).rejects.toThrow("Unauthorized");
      });

      it("rejects non-admin member", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "member" });

        await expect(
          getMessageVolume("org-1", new Date(), new Date())
        ).rejects.toThrow("Only admins can view analytics");
      });

      it("rejects non-member", async () => {
        mockFindFirst.mockResolvedValueOnce(null);

        await expect(
          getMessageVolume("org-1", new Date(), new Date())
        ).rejects.toThrow("Only admins can view analytics");
      });

      it("allows admin access", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

        const result = await getMessageVolume("org-1", new Date(), new Date());

        expect(Array.isArray(result)).toBe(true);
      });

      it("allows owner access", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "owner" });

        const result = await getMessageVolume("org-1", new Date(), new Date());

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe("getActiveUsers", () => {
      it("rejects unauthenticated user", async () => {
        mockGetSession.mockResolvedValue(null);

        await expect(
          getActiveUsers("org-1", new Date(), new Date())
        ).rejects.toThrow("Unauthorized");
      });

      it("rejects non-admin", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "member" });

        await expect(
          getActiveUsers("org-1", new Date(), new Date())
        ).rejects.toThrow("Only admins can view analytics");
      });

      it("allows admin access", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

        const result = await getActiveUsers("org-1", new Date(), new Date());

        expect(result).toHaveProperty("dau");
        expect(result).toHaveProperty("wau");
        expect(result).toHaveProperty("mau");
        expect(result).toHaveProperty("trend");
      });
    });

    describe("getChannelActivity", () => {
      it("rejects unauthenticated user", async () => {
        mockGetSession.mockResolvedValue(null);

        await expect(
          getChannelActivity("org-1", new Date(), new Date())
        ).rejects.toThrow("Unauthorized");
      });

      it("rejects non-admin", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "member" });

        await expect(
          getChannelActivity("org-1", new Date(), new Date())
        ).rejects.toThrow("Only admins can view analytics");
      });

      it("allows admin access", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

        const result = await getChannelActivity("org-1", new Date(), new Date());

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe("getPeakUsageTimes", () => {
      it("rejects unauthenticated user", async () => {
        mockGetSession.mockResolvedValue(null);

        await expect(
          getPeakUsageTimes("org-1", new Date(), new Date())
        ).rejects.toThrow("Unauthorized");
      });

      it("rejects non-admin", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "member" });

        await expect(
          getPeakUsageTimes("org-1", new Date(), new Date())
        ).rejects.toThrow("Only admins can view analytics");
      });

      it("allows admin access", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

        const result = await getPeakUsageTimes("org-1", new Date(), new Date());

        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe("getStorageUsage", () => {
      it("rejects unauthenticated user", async () => {
        mockGetSession.mockResolvedValue(null);

        await expect(getStorageUsage("org-1")).rejects.toThrow("Unauthorized");
      });

      it("rejects non-admin", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "member" });

        await expect(getStorageUsage("org-1")).rejects.toThrow(
          "Only admins can view analytics"
        );
      });

      it("allows admin access", async () => {
        mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

        const result = await getStorageUsage("org-1");

        expect(result).toHaveProperty("total");
        expect(result).toHaveProperty("byChannel");
      });
    });
  });

  describe("Return type structure validation", () => {
    it("getMessageVolume returns MessageVolumePoint array", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

      const result = await getMessageVolume("org-1", new Date(), new Date());

      expect(Array.isArray(result)).toBe(true);
      // When data exists, each item should have date and count
    });

    it("getActiveUsers returns ActiveUsersResult", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

      const result = await getActiveUsers("org-1", new Date(), new Date());

      expect(result).toHaveProperty("dau");
      expect(Array.isArray(result.dau)).toBe(true);
      expect(typeof result.wau).toBe("number");
      expect(typeof result.mau).toBe("number");
      expect(["up", "down", "flat"]).toContain(result.trend);
    });

    it("getChannelActivity returns ChannelActivity array", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

      const result = await getChannelActivity("org-1", new Date(), new Date());

      expect(Array.isArray(result)).toBe(true);
    });

    it("getPeakUsageTimes returns PeakUsageTime array", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

      const result = await getPeakUsageTimes("org-1", new Date(), new Date());

      expect(Array.isArray(result)).toBe(true);
    });

    it("getStorageUsage returns StorageUsageResult", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "member-1", role: "admin" });

      const result = await getStorageUsage("org-1");

      expect(typeof result.total).toBe("number");
      expect(Array.isArray(result.byChannel)).toBe(true);
    });
  });
});

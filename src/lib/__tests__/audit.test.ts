import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import {
  auditLog,
  cleanupOldLogs,
  getClientIP,
  getUserAgent,
  AuditEventType,
} from "../audit-logger";

// Mock fs modules
vi.mock("fs/promises", () => ({
  appendFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Store original cwd and mock it
const originalCwd = process.cwd;

describe("Audit Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.cwd to return a predictable path
    process.cwd = () => "/app";
    // Default: logs directory exists
    vi.mocked(fsSync.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  describe("auditLog", () => {
    it("writes event with required fields", async () => {
      vi.mocked(fs.appendFile).mockResolvedValueOnce(undefined);

      await auditLog({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        userId: "user-123",
      });

      expect(fs.appendFile).toHaveBeenCalled();
      const [filePath, content] = vi.mocked(fs.appendFile).mock.calls[0];

      // Verify file path is in logs directory
      expect(filePath).toMatch(/\/app\/logs\/\d{4}-\d{2}-\d{2}\.jsonl$/);

      // Parse the JSON line and verify fields
      const event = JSON.parse((content as string).trim());
      expect(event.eventType).toBe("AUTH_LOGIN_SUCCESS");
      expect(event.userId).toBe("user-123");
      expect(event.timestamp).toBeDefined();
      // Verify timestamp is valid ISO 8601
      expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
    });

    it("includes optional fields when provided", async () => {
      vi.mocked(fs.appendFile).mockResolvedValueOnce(undefined);

      await auditLog({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        userId: "user-123",
        ip: "192.168.1.100",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        organizationId: "org-456",
        details: { method: "password" },
      });

      const [, content] = vi.mocked(fs.appendFile).mock.calls[0];
      const event = JSON.parse((content as string).trim());

      expect(event.ip).toBe("192.168.1.100");
      expect(event.userAgent).toBe("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
      expect(event.organizationId).toBe("org-456");
      expect(event.details).toEqual({ method: "password" });
    });

    it("creates logs directory if it does not exist", async () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(fs.appendFile).mockResolvedValueOnce(undefined);

      await auditLog({
        eventType: AuditEventType.AUTH_LOGOUT,
        userId: "user-123",
      });

      expect(fs.mkdir).toHaveBeenCalledWith("/app/logs", { recursive: true });
    });

    it("is non-blocking (returns quickly)", async () => {
      vi.mocked(fs.appendFile).mockResolvedValueOnce(undefined);

      const startTime = Date.now();
      await auditLog({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        userId: "user-123",
      });
      const endTime = Date.now();

      // Should complete within 50ms (generous buffer for test environment)
      expect(endTime - startTime).toBeLessThan(50);
    });

    it("does not throw on write failure (fire-and-forget)", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(fs.appendFile).mockRejectedValueOnce(new Error("Disk full"));

      // Should not throw
      await expect(
        auditLog({
          eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        })
      ).resolves.toBeUndefined();

      // Should log error to console
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Audit log write failed:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("logs AUTH_LOGIN_FAILURE events without userId", async () => {
      vi.mocked(fs.appendFile).mockResolvedValueOnce(undefined);

      await auditLog({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        details: { email: "unknown@example.com" },
      });

      const [, content] = vi.mocked(fs.appendFile).mock.calls[0];
      const event = JSON.parse((content as string).trim());

      expect(event.eventType).toBe("AUTH_LOGIN_FAILURE");
      expect(event.userId).toBeUndefined();
      expect(event.details.email).toBe("unknown@example.com");
    });

    it("logs ADMIN_UNLOCK_USER with targetId", async () => {
      vi.mocked(fs.appendFile).mockResolvedValueOnce(undefined);

      await auditLog({
        eventType: AuditEventType.ADMIN_UNLOCK_USER,
        userId: "admin-123",
        targetId: "locked-user-456",
      });

      const [, content] = vi.mocked(fs.appendFile).mock.calls[0];
      const event = JSON.parse((content as string).trim());

      expect(event.eventType).toBe("ADMIN_UNLOCK_USER");
      expect(event.userId).toBe("admin-123");
      expect(event.targetId).toBe("locked-user-456");
    });

    it("uses correct filename format (YYYY-MM-DD.jsonl)", async () => {
      vi.mocked(fs.appendFile).mockResolvedValueOnce(undefined);

      await auditLog({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        userId: "user-123",
      });

      const [filePath] = vi.mocked(fs.appendFile).mock.calls[0];
      const filename = path.basename(filePath as string);

      // Should match YYYY-MM-DD.jsonl format
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}\.jsonl$/);
    });
  });

  describe("cleanupOldLogs", () => {
    it("deletes events older than retention period", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Files from 100 days ago (older than 90-day retention)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const oldFilename = `${oldDate.toISOString().split("T")[0]}.jsonl`;

      // File from today (within retention)
      const todayFilename = `${new Date().toISOString().split("T")[0]}.jsonl`;

      vi.mocked(fsSync.readdirSync).mockReturnValue([
        oldFilename,
        todayFilename,
      ] as unknown as ReturnType<typeof fsSync.readdirSync>);

      const deletedCount = cleanupOldLogs(90);

      expect(deletedCount).toBe(1);
      expect(fsSync.unlinkSync).toHaveBeenCalledWith(`/app/logs/${oldFilename}`);
      expect(fsSync.unlinkSync).not.toHaveBeenCalledWith(`/app/logs/${todayFilename}`);

      consoleSpy.mockRestore();
    });

    it("returns 0 when no logs directory exists", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      vi.mocked(fsSync.existsSync).mockReturnValue(false);

      const deletedCount = cleanupOldLogs();

      expect(deletedCount).toBe(0);
      expect(fsSync.unlinkSync).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("skips invalid filenames", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      vi.mocked(fsSync.readdirSync).mockReturnValue([
        "invalid-name.jsonl",
        "not-a-date.jsonl",
        "2026-01-15.jsonl", // valid
      ] as unknown as ReturnType<typeof fsSync.readdirSync>);

      cleanupOldLogs(90);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping invalid filename")
      );

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it("uses default 90-day retention when not specified", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // File exactly 91 days ago (should be deleted)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);
      const oldFilename = `${oldDate.toISOString().split("T")[0]}.jsonl`;

      vi.mocked(fsSync.readdirSync).mockReturnValue([
        oldFilename,
      ] as unknown as ReturnType<typeof fsSync.readdirSync>);

      const deletedCount = cleanupOldLogs(); // No argument = 90 days

      expect(deletedCount).toBe(1);

      consoleSpy.mockRestore();
    });

    it("keeps files within retention period", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // File from 30 days ago (within 90-day retention)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const recentFilename = `${recentDate.toISOString().split("T")[0]}.jsonl`;

      vi.mocked(fsSync.readdirSync).mockReturnValue([
        recentFilename,
      ] as unknown as ReturnType<typeof fsSync.readdirSync>);

      const deletedCount = cleanupOldLogs(90);

      expect(deletedCount).toBe(0);
      expect(fsSync.unlinkSync).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("handles delete errors gracefully", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const oldFilename = `${oldDate.toISOString().split("T")[0]}.jsonl`;

      vi.mocked(fsSync.readdirSync).mockReturnValue([
        oldFilename,
      ] as unknown as ReturnType<typeof fsSync.readdirSync>);
      vi.mocked(fsSync.unlinkSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      // Should not throw
      const deletedCount = cleanupOldLogs(90);

      expect(deletedCount).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete"),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it("supports custom retention period", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Reset unlinkSync mock (may have been set to throw in previous test)
      vi.mocked(fsSync.unlinkSync).mockReset();

      // File from 10 days ago
      const date10DaysAgo = new Date();
      date10DaysAgo.setDate(date10DaysAgo.getDate() - 10);
      const filename10Days = `${date10DaysAgo.toISOString().split("T")[0]}.jsonl`;

      vi.mocked(fsSync.readdirSync).mockReturnValue([
        filename10Days,
      ] as unknown as ReturnType<typeof fsSync.readdirSync>);

      // With 7-day retention, 10-day-old file should be deleted
      const deletedCount = cleanupOldLogs(7);

      expect(deletedCount).toBe(1);

      consoleSpy.mockRestore();
    });
  });

  describe("getClientIP", () => {
    it("extracts IP from x-forwarded-for header", () => {
      const headers = new Headers({
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      });

      const ip = getClientIP(headers);

      expect(ip).toBe("203.0.113.195");
    });

    it("extracts IP from x-real-ip header", () => {
      const headers = new Headers({
        "x-real-ip": "192.168.1.50",
      });

      const ip = getClientIP(headers);

      expect(ip).toBe("192.168.1.50");
    });

    it("prefers x-forwarded-for over x-real-ip", () => {
      const headers = new Headers({
        "x-forwarded-for": "10.0.0.1",
        "x-real-ip": "10.0.0.2",
      });

      const ip = getClientIP(headers);

      expect(ip).toBe("10.0.0.1");
    });

    it("returns undefined when no IP headers present", () => {
      const headers = new Headers({});

      const ip = getClientIP(headers);

      expect(ip).toBeUndefined();
    });

    it("returns undefined for undefined request", () => {
      const ip = getClientIP(undefined);

      expect(ip).toBeUndefined();
    });

    it("works with Request object", () => {
      const request = new Request("https://example.com", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });

      const ip = getClientIP(request);

      expect(ip).toBe("1.2.3.4");
    });
  });

  describe("getUserAgent", () => {
    it("extracts user agent from headers", () => {
      const headers = new Headers({
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      });

      const ua = getUserAgent(headers);

      expect(ua).toBe("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    });

    it("returns undefined when no user agent header", () => {
      const headers = new Headers({});

      const ua = getUserAgent(headers);

      expect(ua).toBeUndefined();
    });

    it("returns undefined for undefined request", () => {
      const ua = getUserAgent(undefined);

      expect(ua).toBeUndefined();
    });

    it("works with Request object", () => {
      const request = new Request("https://example.com", {
        headers: { "user-agent": "TestAgent/1.0" },
      });

      const ua = getUserAgent(request);

      expect(ua).toBe("TestAgent/1.0");
    });
  });
});

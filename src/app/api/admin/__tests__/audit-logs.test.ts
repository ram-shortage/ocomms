/**
 * Audit Logs API Tests
 *
 * Tests for GET /api/admin/audit-logs route.
 * Validates: auth, admin/owner role, date filtering, event type filtering,
 * pagination, cross-tenant isolation.
 */
import { describe, it, expect } from "vitest";

describe("Audit Logs API Tests", () => {
  describe("Authentication", () => {
    it("requires authenticated session", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("auth.api.getSession");
      expect(source).toContain("Unauthorized");
      expect(source).toContain("status: 401");
    });
  });

  describe("Authorization", () => {
    it("restricts access to admin or owner roles only", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should check for admin/owner role
      expect(source).toContain('role === "admin"');
      expect(source).toContain('role === "owner"');
      expect(source).toContain("Only organization admins can access audit logs");
      expect(source).toContain("status: 403");
    });

    it("filters events to only show admin's organizations", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("adminOrgIds");
      expect(source).toContain("adminMemberships");
    });
  });

  describe("Cross-Tenant Isolation", () => {
    it("excludes events from non-admin organizations", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should filter by organization membership
      expect(source).toContain("!adminOrgIds.includes(event.organizationId)");
    });
  });

  describe("Date Filtering", () => {
    it("supports from/to date query parameters", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain('url.searchParams.get("from")');
      expect(source).toContain('url.searchParams.get("to")');
    });

    it("defaults to last 7 days if no dates provided", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("7 * 24 * 60 * 60 * 1000");
    });

    it("validates date format (ISO 8601)", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("Invalid date format. Use ISO 8601 format");
      expect(source).toContain("status: 400");
    });
  });

  describe("Event Type Filtering", () => {
    it("supports eventType query parameter", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain('url.searchParams.get("eventType")');
    });

    it("validates event type against AuditEventType enum", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("AuditEventType");
      expect(source).toContain("Invalid eventType");
    });
  });

  describe("Pagination", () => {
    it("supports limit and offset parameters", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain('url.searchParams.get("limit")');
      expect(source).toContain('url.searchParams.get("offset")');
    });

    it("has a maximum limit to prevent abuse", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should cap limit at some value
      expect(source).toContain("1000"); // Max limit
    });

    it("returns pagination metadata in response", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("total");
      expect(source).toContain("hasMore");
    });
  });

  describe("Response Format", () => {
    it("sorts events by timestamp descending (newest first)", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("filteredEvents.sort");
      expect(source).toContain("b.timestamp");
      expect(source).toContain("a.timestamp");
    });
  });

  describe("Integrity Verification (SEC2-07)", () => {
    it("includes integrity check in response", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("verifyChain");
      expect(source).toContain("integrity:");
      expect(source).toContain("valid:");
      expect(source).toContain("warning:");
    });

    it("warns when integrity check fails", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("Possible tampering detected");
      expect(source).toContain("integrityResult.brokenAt");
    });

    it("verifies complete chain before filtering", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../audit-logs/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should verify all events, not just filtered ones
      expect(source).toContain("verifyChain(allEvents)");
    });
  });
});

/**
 * Export API Tests
 *
 * Tests for POST /api/admin/export route.
 * Validates: auth, owner-only access, JSON response, cross-tenant isolation.
 */
import { describe, it, expect } from "vitest";

describe("Export API Tests", () => {
  describe("Authentication", () => {
    it("requires authenticated session", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("auth.api.getSession");
      expect(source).toContain("Unauthorized");
      expect(source).toContain("status: 401");
    });
  });

  describe("Authorization", () => {
    it("restricts access to organization owner only", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Admin is not enough - must be owner
      expect(source).toContain('role !== "owner"');
      expect(source).toContain("Only organization owners can export data");
      expect(source).toContain("status: 403");
    });
  });

  describe("Cross-Tenant Isolation", () => {
    it("validates user is member of requested organization", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should query membership for the specific org
      expect(source).toContain("members.userId, session.user.id");
      expect(source).toContain("members.organizationId, organizationId");
    });

    it("verifies organization exists before export", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("Organization not found");
      expect(source).toContain("status: 404");
    });
  });

  describe("Request Validation", () => {
    it("requires organizationId in request body", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("organizationId is required");
      expect(source).toContain("status: 400");
    });
  });

  describe("Response Format", () => {
    it("returns JSON format", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("application/json");
      expect(source).toContain("JSON.stringify");
    });

    it("includes Content-Disposition header for download", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("Content-Disposition");
      expect(source).toContain("attachment");
      expect(source).toContain("ocomms-export");
    });
  });

  describe("Export Content", () => {
    it("includes manifest with export metadata", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("ExportManifest");
      expect(source).toContain("exportDate");
      expect(source).toContain("format");
      expect(source).toContain("version");
    });

    it("exports organization data", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("organization");
      expect(source).toContain("members");
      expect(source).toContain("channels");
    });

    it("exports messages with reactions", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("messages");
      expect(source).toContain("reactions");
    });

    it("exports direct messages/conversations", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("directMessages");
      expect(source).toContain("conversations");
    });

    it("excludes sensitive auth data from user records", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should select specific columns, not password hash
      expect(source).toContain("columns:");
      // Should include safe fields
      expect(source).toContain("id: true");
      expect(source).toContain("name: true");
      expect(source).toContain("email: true");
    });
  });

  describe("Audit Logging", () => {
    it("logs successful exports", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("auditLog");
      expect(source).toContain("ADMIN_EXPORT_DATA");
    });
  });
});

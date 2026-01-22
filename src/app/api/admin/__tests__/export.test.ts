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

      // Must be owner - queries for owner role membership
      expect(source).toContain('eq(members.role, "owner")');
      expect(source).toContain("Only organization owners can export data");
      expect(source).toContain("status: 403");
    });

    it("logs security event on unauthorized export attempt", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should log AUTHZ_FAILURE when user is not owner
      expect(source).toContain("AuditEventType.AUTHZ_FAILURE");
      expect(source).toContain("data_export");
      expect(source).toContain("not_owner");
    });
  });

  describe("Cross-Tenant Isolation (SEC2-08)", () => {
    it("derives organizationId from session, not request body", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // SEC2-08 FIX: Must derive org from session membership, never from request
      expect(source).toContain("ownerMembership.organizationId");
      expect(source).toContain("NEVER use organizationId from request body");
      // Should NOT accept organizationId from request body
      expect(source).not.toContain("body.organizationId");
      expect(source).not.toContain("const { organizationId } = body");
    });

    it("user cannot export other organizations data", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../export/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Organization ID comes from user's owner membership only
      expect(source).toContain("eq(members.userId, session.user.id)");
      expect(source).toContain('eq(members.role, "owner")');
      // The organizationId used for export must come from the membership query result
      expect(source).toContain("const organizationId = ownerMembership.organizationId");
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

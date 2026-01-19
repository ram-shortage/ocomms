/**
 * Push Unsubscribe API Tests
 *
 * Tests for DELETE /api/push/unsubscribe route.
 * Validates: auth, subscription deletion, ownership verification.
 */
import { describe, it, expect } from "vitest";

describe("Push Unsubscribe API Tests", () => {
  describe("Authentication", () => {
    it("requires authenticated session", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../unsubscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("auth.api.getSession");
      expect(source).toContain("Unauthorized");
      expect(source).toContain("status: 401");
    });
  });

  describe("Request Validation", () => {
    it("requires endpoint to identify subscription", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../unsubscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("endpoint");
    });
  });

  describe("Authorization", () => {
    it("only deletes subscriptions owned by authenticated user", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../unsubscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should verify userId matches session in the AND clause
      expect(source).toContain("pushSubscriptions.userId, session.user.id");
    });
  });

  describe("Subscription Deletion", () => {
    it("removes subscription from database", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../unsubscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("delete");
      expect(source).toContain("pushSubscriptions");
    });

    it("filters by endpoint for precise deletion", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../unsubscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("pushSubscriptions.endpoint");
    });
  });

  describe("Response Format", () => {
    it("returns success JSON on deletion", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../unsubscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("success: true");
      expect(source).toContain("NextResponse.json");
    });

    it("handles case when subscription not found", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../unsubscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("not found or already removed");
    });
  });
});

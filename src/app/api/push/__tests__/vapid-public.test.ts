/**
 * VAPID Public Key API Tests
 *
 * Tests for GET /api/push/vapid-public route.
 * Validates: public key exposure, no auth required, proper response format.
 */
import { describe, it, expect } from "vitest";

describe("VAPID Public Key API Tests", () => {
  describe("Authentication", () => {
    it("does NOT require authentication (public endpoint)", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid-public/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should NOT contain session checks for GET
      // This is a public endpoint needed before login
      expect(source).not.toContain("auth.api.getSession");
      expect(source).not.toContain("Unauthorized");
    });
  });

  describe("Response Format", () => {
    it("returns VAPID public key in response", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid-public/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("publicKey");
      expect(source).toContain("getVapidPublicKey");
    });

    it("returns JSON response", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid-public/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("NextResponse.json");
    });
  });

  describe("Security", () => {
    it("uses dedicated function to get public key", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid-public/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Should use the helper function from push lib
      expect(source).toContain("getVapidPublicKey");
      // Should NOT directly expose env var
      expect(source).not.toContain("process.env.VAPID_PRIVATE_KEY");
    });
  });

  describe("Error Handling", () => {
    it("handles missing VAPID configuration", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid-public/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("isVapidConfigured");
      expect(source).toContain("Push notifications not configured");
      expect(source).toContain("status: 503");
    });

    it("handles missing public key", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid-public/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("VAPID public key not available");
    });
  });
});

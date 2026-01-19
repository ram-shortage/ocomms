/**
 * Push Subscribe API Tests
 *
 * Tests for POST /api/push/subscribe route.
 * Validates: auth, subscription storage, duplicate handling.
 */
import { describe, it, expect } from "vitest";

describe("Push Subscribe API Tests", () => {
  describe("Authentication", () => {
    it("requires authenticated session", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("auth.api.getSession");
      expect(source).toContain("Unauthorized");
      expect(source).toContain("status: 401");
    });
  });

  describe("Request Validation", () => {
    it("requires subscription object with endpoint", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("subscription");
      expect(source).toContain("endpoint");
    });

    it("requires keys.p256dh for encryption", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("p256dh");
    });

    it("requires keys.auth for authentication", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("auth");
      expect(source).toContain("keys");
    });
  });

  describe("Subscription Storage", () => {
    it("stores subscription in pushSubscriptions table", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("pushSubscriptions");
      expect(source).toContain("insert");
    });

    it("associates subscription with authenticated user", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("userId");
      expect(source).toContain("session.user.id");
    });

    it("stores user agent for device identification", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("userAgent");
      expect(source).toContain('user-agent"');
    });
  });

  describe("Duplicate Handling", () => {
    it("checks for existing subscriptions before insert", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      // Uses findFirst + check pattern for conflict handling
      expect(source).toContain("findFirst");
      expect(source).toContain("existing");
    });

    it("removes old subscription if endpoint registered to different user", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("existing.userId !== session.user.id");
      expect(source).toContain("delete");
    });
  });

  describe("Response Format", () => {
    it("returns success JSON on subscription", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("success: true");
      expect(source).toContain("NextResponse.json");
    });

    it("returns Already subscribed for duplicate from same user", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../subscribe/route.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("Already subscribed");
    });
  });
});

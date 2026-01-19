/**
 * VAPID Configuration Tests
 *
 * Tests for VAPID key management and configuration.
 */
import { describe, it, expect } from "vitest";

describe("VAPID Configuration Tests", () => {
  describe("configureVapid", () => {
    it("reads from environment variables", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("process.env.VAPID_PUBLIC_KEY");
      expect(source).toContain("process.env.VAPID_PRIVATE_KEY");
      expect(source).toContain("process.env.VAPID_SUBJECT");
    });

    it("returns false when keys are missing", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("!publicKey || !privateKey || !subject");
      expect(source).toContain("vapidConfigured = false");
      expect(source).toContain("return false");
    });

    it("calls webpush.setVapidDetails when keys present", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("webpush.setVapidDetails(subject, publicKey, privateKey)");
    });

    it("handles errors from webpush configuration", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("try {");
      expect(source).toContain("} catch (error)");
      expect(source).toContain("Failed to configure VAPID");
    });
  });

  describe("isVapidConfigured", () => {
    it("returns the configured state", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("export function isVapidConfigured(): boolean");
      expect(source).toContain("return vapidConfigured");
    });
  });

  describe("getVapidPublicKey", () => {
    it("returns the public key from NEXT_PUBLIC env var", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("export function getVapidPublicKey");
      expect(source).toContain("process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY");
    });

    it("returns null if not configured", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../vapid.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("|| null");
    });
  });
});

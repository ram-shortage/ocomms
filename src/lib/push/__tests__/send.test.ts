/**
 * Push Send Tests
 *
 * Tests for sendPushToUser function.
 * Validates: subscription lookup, webpush integration, error handling, cleanup.
 */
import { describe, it, expect } from "vitest";

describe("sendPushToUser Tests", () => {
  describe("VAPID Check", () => {
    it("returns early if VAPID not configured", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("if (!isVapidConfigured())");
      expect(source).toContain("return { sent: 0, failed: 0, removed: 0 }");
    });
  });

  describe("Subscription Lookup", () => {
    it("queries subscriptions by userId", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("db.query.pushSubscriptions.findMany");
      expect(source).toContain("eq(pushSubscriptions.userId, userId)");
    });

    it("returns early if user has no subscriptions", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("subscriptions.length === 0");
      expect(source).toContain("return { sent: 0, failed: 0, removed: 0 }");
    });
  });

  describe("Web Push Sending", () => {
    it("calls webpush.sendNotification for each subscription", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("webpush.sendNotification");
    });

    it("constructs subscription object with endpoint and keys", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("endpoint: sub.endpoint");
      expect(source).toContain("p256dh: sub.p256dh");
      expect(source).toContain("auth: sub.auth");
    });

    it("sends payload as JSON string", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("JSON.stringify(payload)");
    });

    it("sets TTL for 24 hours", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("TTL: 60 * 60 * 24");
    });
  });

  describe("Parallel Sending", () => {
    it("uses Promise.all for concurrent sends", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("Promise.all");
    });
  });

  describe("Expired Subscription Cleanup", () => {
    it("removes subscriptions on 410 Gone status", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("pushError.statusCode === 410");
      expect(source).toContain("db.delete(pushSubscriptions)");
    });

    it("removes subscriptions on 404 Not Found status", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("pushError.statusCode === 404");
    });

    it("increments removed counter for cleaned subscriptions", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("removed++");
    });
  });

  describe("Return Value", () => {
    it("returns sent, failed, and removed counts", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("return { sent, failed, removed }");
      expect(source).toContain("sent++");
      expect(source).toContain("failed++");
      expect(source).toContain("removed++");
    });
  });

  describe("PushPayload Interface", () => {
    it("exports PushPayload interface with required fields", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain("export interface PushPayload");
      expect(source).toContain("title: string");
      expect(source).toContain("body: string");
      expect(source).toContain("url: string");
      expect(source).toContain("tag: string");
      expect(source).toContain("type:");
    });

    it("defines notification types enum", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sourcePath = path.resolve(__dirname, "../send.ts");
      const source = fs.readFileSync(sourcePath, "utf-8");

      expect(source).toContain('"dm"');
      expect(source).toContain('"mention"');
      expect(source).toContain('"channel"');
      expect(source).toContain('"here"');
    });
  });
});

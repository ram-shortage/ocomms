/**
 * Typing Handler Authorization Tests
 *
 * Validates M-7 security fix: Typing handlers require authorization before
 * broadcasting typing events to channels or conversations.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Typing Handler Authorization (M-7 fix)", () => {
  const sourcePath = path.resolve(__dirname, "../handlers/typing.ts");
  const source = fs.readFileSync(sourcePath, "utf-8");

  describe("authorization imports", () => {
    it("imports isChannelMember from authz", () => {
      expect(source).toContain("isChannelMember");
    });

    it("imports isConversationParticipant from authz", () => {
      expect(source).toContain("isConversationParticipant");
    });

    it("imports from relative authz path", () => {
      expect(source).toContain('from "../authz"');
    });
  });

  describe("typing:start authorization", () => {
    it("checks channel membership for channel typing", () => {
      const startSection = source.slice(
        source.indexOf('socket.on("typing:start"'),
        source.indexOf('socket.on("typing:stop"')
      );
      expect(startSection).toContain("isChannelMember");
    });

    it("checks conversation participation for DM typing", () => {
      const startSection = source.slice(
        source.indexOf('socket.on("typing:start"'),
        source.indexOf('socket.on("typing:stop"')
      );
      expect(startSection).toContain("isConversationParticipant");
    });

    it("emits error for unauthorized channel typing", () => {
      const startSection = source.slice(
        source.indexOf('socket.on("typing:start"'),
        source.indexOf('socket.on("typing:stop"')
      );
      expect(startSection).toContain("Not authorized to type in this channel");
    });

    it("emits error for unauthorized conversation typing", () => {
      const startSection = source.slice(
        source.indexOf('socket.on("typing:start"'),
        source.indexOf('socket.on("typing:stop"')
      );
      expect(startSection).toContain("Not authorized to type in this conversation");
    });

    it("returns early after authorization failure", () => {
      const startSection = source.slice(
        source.indexOf('socket.on("typing:start"'),
        source.indexOf('socket.on("typing:stop"')
      );
      // Should have return statements after error emission
      expect(startSection).toMatch(/socket\.emit\("error".*\n\s*return;/);
    });
  });

  describe("typing:stop authorization", () => {
    it("checks channel membership before broadcasting stop event", () => {
      const stopSection = source.slice(
        source.indexOf('socket.on("typing:stop"')
      );
      expect(stopSection).toContain("isChannelMember");
    });

    it("checks conversation participation before broadcasting stop event", () => {
      const stopSection = source.slice(
        source.indexOf('socket.on("typing:stop"')
      );
      expect(stopSection).toContain("isConversationParticipant");
    });

    it("emits error for unauthorized channel typing stop", () => {
      const stopSection = source.slice(
        source.indexOf('socket.on("typing:stop"')
      );
      expect(stopSection).toContain("Not authorized");
    });
  });

  describe("authorization pattern consistency", () => {
    it("uses async handlers for authorization checks", () => {
      expect(source).toContain('socket.on("typing:start", async');
      expect(source).toContain('socket.on("typing:stop", async');
    });

    it("awaits authorization check results", () => {
      expect(source).toContain("await isChannelMember");
      expect(source).toContain("await isConversationParticipant");
    });

    it("checks target type to determine authorization method", () => {
      // Should check if targetType is channel or conversation
      expect(source).toContain('targetType === "channel"');
    });
  });

  describe("typing state tracking", () => {
    it("tracks active typing state for disconnect cleanup", () => {
      expect(source).toContain("activeTyping");
      expect(source).toContain("TypingState");
    });

    it("clears typing state on stop", () => {
      const stopSection = source.slice(
        source.indexOf('socket.on("typing:stop"')
      );
      expect(stopSection).toContain("activeTyping = null");
    });

    it("handles disconnect for typing cleanup", () => {
      expect(source).toContain('socket.on("disconnect"');
      expect(source).toContain("if (activeTyping)");
    });
  });
});

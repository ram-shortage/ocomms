/**
 * Mentions Library Tests
 *
 * Tests for mention parsing, extraction, and highlighting.
 * Validates: @username, @"Display Name", @channel, @here patterns.
 */
import { describe, it, expect } from "vitest";
import {
  parseMentions,
  extractMentionedUsernames,
  formatMentionForInsert,
  MENTION_REGEX,
} from "../mentions";

describe("parseMentions", () => {
  describe("@username patterns", () => {
    it("parses simple @username", () => {
      const mentions = parseMentions("Hello @john!");
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "user",
        value: "john",
        raw: "@john",
      });
    });

    it("parses multiple @usernames", () => {
      const mentions = parseMentions("Hey @alice and @bob!");
      expect(mentions).toHaveLength(2);
      expect(mentions[0].value).toBe("alice");
      expect(mentions[1].value).toBe("bob");
    });

    it("handles alphanumeric usernames with dots and underscores", () => {
      const mentions = parseMentions("@user.name @user_name @user-name @user123");
      expect(mentions).toHaveLength(4);
      expect(mentions[0].value).toBe("user.name");
      expect(mentions[1].value).toBe("user_name");
      expect(mentions[2].value).toBe("user-name");
      expect(mentions[3].value).toBe("user123");
    });

    it("tracks correct start/end positions", () => {
      const content = "Hello @john, welcome!";
      const mentions = parseMentions(content);
      expect(mentions[0].start).toBe(6);
      expect(mentions[0].end).toBe(11); // "Hello " = 6 chars, "@john" = 5 chars
      expect(content.slice(mentions[0].start, mentions[0].end)).toBe("@john");
    });
  });

  describe("@\"Display Name\" patterns", () => {
    it("parses quoted names with spaces", () => {
      const mentions = parseMentions('Hello @"John Doe"!');
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "user",
        value: "John Doe",
        raw: '@"John Doe"',
      });
    });

    it("handles multiple quoted names", () => {
      const mentions = parseMentions('@"Alice Smith" and @"Bob Jones"');
      expect(mentions).toHaveLength(2);
      expect(mentions[0].value).toBe("Alice Smith");
      expect(mentions[1].value).toBe("Bob Jones");
    });

    it("preserves exact spacing in quoted names", () => {
      const mentions = parseMentions('@"Multi  Spaced  Name"');
      expect(mentions[0].value).toBe("Multi  Spaced  Name");
    });
  });

  describe("@channel and @here special mentions", () => {
    it("parses @channel as channel type", () => {
      const mentions = parseMentions("Hey @channel, announcement!");
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "channel",
        value: "channel",
      });
    });

    it("parses @here as here type", () => {
      const mentions = parseMentions("Anyone @here?");
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: "here",
        value: "here",
      });
    });

    it("is case-insensitive for special mentions", () => {
      const channelMentions = parseMentions("@Channel @CHANNEL @cHaNnEl");
      expect(channelMentions.every((m) => m.type === "channel")).toBe(true);

      const hereMentions = parseMentions("@Here @HERE @hErE");
      expect(hereMentions.every((m) => m.type === "here")).toBe(true);
    });
  });

  describe("mixed patterns", () => {
    it("handles mix of user and special mentions", () => {
      const mentions = parseMentions(
        '@john @"Jane Doe" @channel @here'
      );
      expect(mentions).toHaveLength(4);
      expect(mentions[0].type).toBe("user");
      expect(mentions[1].type).toBe("user");
      expect(mentions[2].type).toBe("channel");
      expect(mentions[3].type).toBe("here");
    });

    it("returns empty array for no mentions", () => {
      const mentions = parseMentions("No mentions here!");
      expect(mentions).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles @ at end of string", () => {
      const mentions = parseMentions("email: test@");
      expect(mentions).toHaveLength(0);
    });

    it("handles empty string", () => {
      const mentions = parseMentions("");
      expect(mentions).toHaveLength(0);
    });

    it("handles @ followed by space", () => {
      const mentions = parseMentions("@ someone");
      expect(mentions).toHaveLength(0);
    });
  });
});

describe("extractMentionedUsernames", () => {
  it("returns only user mentions, excludes @channel and @here", () => {
    const usernames = extractMentionedUsernames(
      '@john @channel @"Jane Doe" @here'
    );
    expect(usernames).toEqual(["john", "Jane Doe"]);
  });

  it("returns empty array for no user mentions", () => {
    const usernames = extractMentionedUsernames("@channel @here");
    expect(usernames).toEqual([]);
  });

  it("returns empty array for no mentions at all", () => {
    const usernames = extractMentionedUsernames("Hello world");
    expect(usernames).toEqual([]);
  });
});

describe("formatMentionForInsert", () => {
  it("returns @username for names without spaces", () => {
    expect(formatMentionForInsert("john")).toBe("@john");
  });

  it("wraps names with spaces in quotes", () => {
    expect(formatMentionForInsert("John Doe")).toBe('@"John Doe"');
  });

  it("handles single word names", () => {
    expect(formatMentionForInsert("alice")).toBe("@alice");
  });
});

describe("MENTION_REGEX", () => {
  it("exports regex for external use", () => {
    expect(MENTION_REGEX).toBeInstanceOf(RegExp);
  });

  it("matches expected patterns globally", () => {
    const matches = '@john @"Jane Doe" @channel'.match(MENTION_REGEX);
    expect(matches).toHaveLength(3);
  });
});

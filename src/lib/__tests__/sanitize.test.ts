/**
 * Sanitization Library Tests
 *
 * SEC2-05: Tests for Unicode and HTML sanitization functions.
 * Validates dangerous character replacement and safe HTML handling.
 */
import { describe, it, expect } from "vitest";
import { sanitizeUnicode, sanitizeHtml } from "../sanitize";

describe("sanitizeUnicode", () => {
  describe("control character replacement", () => {
    it("replaces NULL character (U+0000)", () => {
      const result = sanitizeUnicode("Hello\u0000World");
      expect(result).toBe("Hello\u25A1World");
    });

    it("replaces backspace (U+0008)", () => {
      const result = sanitizeUnicode("Hello\u0008World");
      expect(result).toBe("Hello\u25A1World");
    });

    it("replaces vertical tab (U+000B)", () => {
      const result = sanitizeUnicode("Hello\u000BWorld");
      expect(result).toBe("Hello\u25A1World");
    });

    it("replaces form feed (U+000C)", () => {
      const result = sanitizeUnicode("Hello\u000CWorld");
      expect(result).toBe("Hello\u25A1World");
    });

    it("replaces C1 control characters (U+0080-U+009F)", () => {
      const result = sanitizeUnicode("Test\u0080\u0090\u009FEnd");
      expect(result).toBe("Test\u25A1\u25A1\u25A1End");
    });

    it("replaces DEL character (U+007F)", () => {
      const result = sanitizeUnicode("Delete\u007FMe");
      expect(result).toBe("Delete\u25A1Me");
    });
  });

  describe("preserves safe whitespace", () => {
    it("preserves tab (U+0009)", () => {
      const result = sanitizeUnicode("Hello\tWorld");
      expect(result).toBe("Hello\tWorld");
    });

    it("preserves newline (U+000A)", () => {
      const result = sanitizeUnicode("Hello\nWorld");
      expect(result).toBe("Hello\nWorld");
    });

    it("preserves carriage return (U+000D)", () => {
      const result = sanitizeUnicode("Hello\rWorld");
      expect(result).toBe("Hello\rWorld");
    });

    it("preserves standard spaces", () => {
      const result = sanitizeUnicode("Hello World");
      expect(result).toBe("Hello World");
    });
  });

  describe("zero-width character handling", () => {
    it("replaces Zero-Width Space (U+200B)", () => {
      const result = sanitizeUnicode("Hidden\u200BText");
      expect(result).toBe("Hidden\u25A1Text");
    });

    it("replaces Zero-Width Non-Joiner (U+200C)", () => {
      const result = sanitizeUnicode("Separate\u200CWords");
      expect(result).toBe("Separate\u25A1Words");
    });

    it("preserves Zero-Width Joiner (U+200D) for emoji sequences", () => {
      // ZWJ is used to combine emoji - must be preserved
      const result = sanitizeUnicode("Join\u200DEmoji");
      expect(result).toBe("Join\u200DEmoji");
    });
  });

  describe("RTL override handling", () => {
    it("replaces Right-to-Left Override (U+202E)", () => {
      // This character can be used to spoof file extensions
      const result = sanitizeUnicode("file\u202Etxt.exe");
      expect(result).toBe("file\u25A1txt.exe");
    });
  });

  describe("emoji preservation", () => {
    it("preserves simple emoji", () => {
      const result = sanitizeUnicode("Hello 😀 World");
      expect(result).toBe("Hello 😀 World");
    });

    it("preserves family emoji (uses ZWJ)", () => {
      // Family emoji: man + ZWJ + woman + ZWJ + girl + ZWJ + boy
      const familyEmoji = "👨‍👩‍👧‍👦";
      const result = sanitizeUnicode(`Family: ${familyEmoji}`);
      expect(result).toBe(`Family: ${familyEmoji}`);
    });

    it("preserves professional emoji (uses ZWJ)", () => {
      // Man technologist: man + ZWJ + laptop
      const techEmoji = "👨‍💻";
      const result = sanitizeUnicode(`Coder: ${techEmoji}`);
      expect(result).toBe(`Coder: ${techEmoji}`);
    });

    it("preserves skin tone modifiers", () => {
      const waveEmoji = "👋🏽";
      const result = sanitizeUnicode(`Wave: ${waveEmoji}`);
      expect(result).toBe(`Wave: ${waveEmoji}`);
    });

    it("preserves flag emoji", () => {
      const flagEmoji = "🇺🇸";
      const result = sanitizeUnicode(`Flag: ${flagEmoji}`);
      expect(result).toBe(`Flag: ${flagEmoji}`);
    });
  });

  describe("valid content preservation", () => {
    it("preserves regular text", () => {
      const result = sanitizeUnicode("Hello World!");
      expect(result).toBe("Hello World!");
    });

    it("preserves numbers and punctuation", () => {
      const result = sanitizeUnicode("Test 123! @#$%");
      expect(result).toBe("Test 123! @#$%");
    });

    it("preserves Unicode letters", () => {
      const result = sanitizeUnicode("Hëllö Wörld 你好 مرحبا");
      expect(result).toBe("Hëllö Wörld 你好 مرحبا");
    });

    it("handles empty string", () => {
      const result = sanitizeUnicode("");
      expect(result).toBe("");
    });
  });

  describe("multiple dangerous characters", () => {
    it("replaces all instances of dangerous characters", () => {
      const result = sanitizeUnicode("\u0000Hello\u200BWorld\u202E!");
      expect(result).toBe("\u25A1Hello\u25A1World\u25A1!");
    });
  });
});

describe("sanitizeHtml", () => {
  describe("allows safe tags", () => {
    it("allows bold tags (b, strong)", () => {
      expect(sanitizeHtml("<b>bold</b>")).toBe("<b>bold</b>");
      expect(sanitizeHtml("<strong>bold</strong>")).toBe("<strong>bold</strong>");
    });

    it("allows italic tags (i, em)", () => {
      expect(sanitizeHtml("<i>italic</i>")).toBe("<i>italic</i>");
      expect(sanitizeHtml("<em>italic</em>")).toBe("<em>italic</em>");
    });

    it("allows anchor tags with href", () => {
      const result = sanitizeHtml('<a href="https://example.com">link</a>');
      expect(result).toBe('<a href="https://example.com">link</a>');
    });

    it("allows anchor tags with title", () => {
      const result = sanitizeHtml('<a href="https://example.com" title="Example">link</a>');
      expect(result).toBe('<a href="https://example.com" title="Example">link</a>');
    });

    it("allows paragraph tags", () => {
      expect(sanitizeHtml("<p>paragraph</p>")).toBe("<p>paragraph</p>");
    });

    it("allows list tags (ul, ol, li)", () => {
      expect(sanitizeHtml("<ul><li>item</li></ul>")).toBe("<ul><li>item</li></ul>");
      expect(sanitizeHtml("<ol><li>item</li></ol>")).toBe("<ol><li>item</li></ol>");
    });

    it("allows line break tags", () => {
      expect(sanitizeHtml("line1<br>line2")).toBe("line1<br>line2");
    });
  });

  describe("removes dangerous tags", () => {
    it("removes script tags", () => {
      const result = sanitizeHtml("<b>Hello</b><script>alert('xss')</script>");
      expect(result).toBe("<b>Hello</b>");
      expect(result).not.toContain("script");
    });

    it("removes style tags", () => {
      const result = sanitizeHtml("<p>text</p><style>body{display:none}</style>");
      expect(result).toBe("<p>text</p>");
      expect(result).not.toContain("style");
    });

    it("removes iframe tags", () => {
      const result = sanitizeHtml('<iframe src="http://evil.com"></iframe>text');
      expect(result).toBe("text");
    });

    it("removes object tags", () => {
      const result = sanitizeHtml('<object data="evil.swf"></object>text');
      expect(result).toBe("text");
    });

    it("removes form tags", () => {
      const result = sanitizeHtml('<form action="evil"><input></form>text');
      expect(result).toBe("text");
    });
  });

  describe("removes dangerous attributes", () => {
    it("removes onclick handlers", () => {
      const result = sanitizeHtml('<p onclick="evil()">text</p>');
      expect(result).toBe("<p>text</p>");
      expect(result).not.toContain("onclick");
    });

    it("removes onerror handlers", () => {
      const result = sanitizeHtml('<p onerror="evil()">text</p>');
      expect(result).toBe("<p>text</p>");
      expect(result).not.toContain("onerror");
    });

    it("removes onload handlers", () => {
      const result = sanitizeHtml('<p onload="evil()">text</p>');
      expect(result).toBe("<p>text</p>");
      expect(result).not.toContain("onload");
    });

    it("removes data attributes", () => {
      const result = sanitizeHtml('<p data-custom="value">text</p>');
      expect(result).toBe("<p>text</p>");
      expect(result).not.toContain("data-");
    });

    it("removes style attributes", () => {
      const result = sanitizeHtml('<p style="color:red">text</p>');
      expect(result).toBe("<p>text</p>");
      expect(result).not.toContain("style");
    });
  });

  describe("handles dangerous href protocols", () => {
    it("removes javascript: protocol", () => {
      const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
      expect(result).toBe("<a>click</a>");
      expect(result).not.toContain("javascript");
    });

    it("removes data: protocol", () => {
      const result = sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">click</a>');
      expect(result).toBe("<a>click</a>");
      expect(result).not.toContain("data:");
    });

    it("allows http: protocol", () => {
      const result = sanitizeHtml('<a href="http://example.com">link</a>');
      expect(result).toContain('href="http://example.com"');
    });

    it("allows https: protocol", () => {
      const result = sanitizeHtml('<a href="https://example.com">link</a>');
      expect(result).toContain('href="https://example.com"');
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("handles plain text", () => {
      expect(sanitizeHtml("Hello World")).toBe("Hello World");
    });

    it("handles nested allowed tags", () => {
      const result = sanitizeHtml("<p><b><i>nested</i></b></p>");
      expect(result).toBe("<p><b><i>nested</i></b></p>");
    });

    it("handles malformed HTML", () => {
      // DOMPurify should handle this gracefully
      const result = sanitizeHtml("<b>unclosed");
      expect(result).toContain("unclosed");
    });
  });

  describe("complex XSS attempts", () => {
    it("handles SVG-based XSS", () => {
      const result = sanitizeHtml('<svg onload="alert(1)"><text>hello</text></svg>');
      expect(result).not.toContain("svg");
      expect(result).not.toContain("onload");
    });

    it("handles img onerror XSS", () => {
      const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain("img");
      expect(result).not.toContain("onerror");
    });

    it("handles meta refresh XSS", () => {
      const result = sanitizeHtml('<meta http-equiv="refresh" content="0;url=javascript:alert(1)">');
      expect(result).not.toContain("meta");
    });
  });
});

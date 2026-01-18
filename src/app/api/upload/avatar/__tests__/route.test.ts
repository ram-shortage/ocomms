import { describe, it, expect } from "vitest";

/**
 * File Signature Validation Test Cases
 *
 * The validateFileSignature function in route.ts validates image files by
 * checking their magic bytes (file signature) rather than trusting client-provided
 * MIME types or file extensions.
 *
 * This prevents XSS attacks where a malicious user could upload HTML/JS files
 * with an image MIME type.
 */

// Helper to create fake file bytes
const createBytes = (arr: number[]): Uint8Array => new Uint8Array(arr);

// Copy of validateFileSignature for testing (function is internal to route.ts)
function validateFileSignature(bytes: Uint8Array): string | null {
  // Check JPEG: starts with FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }

  // Check PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // Check GIF: starts with GIF87a or GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "gif";
  }

  // Check WebP: starts with RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

describe("Avatar Upload File Signature Validation", () => {
  describe("validateFileSignature", () => {
    it("accepts valid JPEG signature", () => {
      // JPEG magic bytes: FF D8 FF (followed by marker like E0, E1, etc.)
      const jpegBytes = createBytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(validateFileSignature(jpegBytes)).toBe("jpg");
    });

    it("accepts valid PNG signature", () => {
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
      const pngBytes = createBytes([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]);
      expect(validateFileSignature(pngBytes)).toBe("png");
    });

    it("accepts valid GIF87a signature", () => {
      // GIF87a: 47 49 46 38 37 61
      const gif87Bytes = createBytes([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
      expect(validateFileSignature(gif87Bytes)).toBe("gif");
    });

    it("accepts valid GIF89a signature", () => {
      // GIF89a: 47 49 46 38 39 61
      const gif89Bytes = createBytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(validateFileSignature(gif89Bytes)).toBe("gif");
    });

    it("accepts valid WebP signature", () => {
      // WebP: RIFF....WEBP
      const webpBytes = createBytes([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00, // size placeholder
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
      ]);
      expect(validateFileSignature(webpBytes)).toBe("webp");
    });

    it("rejects HTML file (XSS attack vector)", () => {
      // <html starts with 3C 68 74 6D 6C
      const htmlBytes = createBytes([0x3c, 0x68, 0x74, 0x6d, 0x6c]);
      expect(validateFileSignature(htmlBytes)).toBe(null);
    });

    it("rejects JavaScript file (XSS attack vector)", () => {
      // <script starts with 3C 73 63 72 69 70 74
      const scriptBytes = createBytes([
        0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74,
      ]);
      expect(validateFileSignature(scriptBytes)).toBe(null);
    });

    it("rejects file with wrong signature despite image extension intent", () => {
      // Random bytes that don't match any image signature
      const fakeImageBytes = createBytes([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      expect(validateFileSignature(fakeImageBytes)).toBe(null);
    });

    it("rejects PDF files", () => {
      // PDF starts with %PDF (25 50 44 46)
      const pdfBytes = createBytes([0x25, 0x50, 0x44, 0x46]);
      expect(validateFileSignature(pdfBytes)).toBe(null);
    });

    it("rejects executable files", () => {
      // EXE/DLL starts with MZ (4D 5A)
      const exeBytes = createBytes([0x4d, 0x5a, 0x00, 0x00]);
      expect(validateFileSignature(exeBytes)).toBe(null);
    });

    it("rejects ZIP files (even renamed to .jpg)", () => {
      // ZIP starts with PK (50 4B)
      const zipBytes = createBytes([0x50, 0x4b, 0x03, 0x04]);
      expect(validateFileSignature(zipBytes)).toBe(null);
    });

    it("handles empty/short input gracefully", () => {
      const emptyBytes = createBytes([]);
      expect(validateFileSignature(emptyBytes)).toBe(null);

      const shortBytes = createBytes([0xff, 0xd8]); // Only 2 bytes, needs 3 for JPEG
      expect(validateFileSignature(shortBytes)).toBe(null);
    });
  });
});

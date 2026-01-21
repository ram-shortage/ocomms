/**
 * Shared file validation library using magic bytes.
 * Validates file content signatures rather than trusting client-provided MIME types.
 */

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const MAX_EMOJI_SIZE = 128 * 1024; // 128KB for emoji (EMOJ-01)
export const EMOJI_DIMENSIONS = 128; // 128x128 output size

export interface ValidatedFile {
  extension: string;
  mimeType: string;
  isImage: boolean;
}

/**
 * Validate file signature (magic bytes) and return file type info.
 * Returns null if file signature doesn't match any allowed type.
 *
 * Supported types:
 * - Images: JPEG, PNG, GIF, WebP
 * - Documents: PDF
 *
 * @param bytes - Uint8Array of file content
 * @returns ValidatedFile with extension, mimeType, isImage or null if invalid
 */
export function validateFileSignature(bytes: Uint8Array): ValidatedFile | null {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg", isImage: true };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
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
    return { extension: "png", mimeType: "image/png", isImage: true };
  }

  // GIF: 47 49 46 38 (37|39) 61 (GIF87a or GIF89a)
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return { extension: "gif", mimeType: "image/gif", isImage: true };
  }

  // WebP: RIFF....WEBP
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
    return { extension: "webp", mimeType: "image/webp", isImage: true };
  }

  // PDF: %PDF (25 50 44 46)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { extension: "pdf", mimeType: "application/pdf", isImage: false };
  }

  // SVG: <?xml or <svg (text-based, check first bytes for common patterns)
  // Note: SVG detection is approximate since it's XML text
  const textStart = new TextDecoder().decode(bytes.slice(0, 100));
  if (
    textStart.trim().startsWith("<?xml") ||
    textStart.trim().startsWith("<svg") ||
    textStart.includes("<svg")
  ) {
    return { extension: "svg", mimeType: "image/svg+xml", isImage: true };
  }

  return null; // Unknown or disallowed type
}

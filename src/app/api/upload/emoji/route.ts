import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";
import sharp from "sharp";
import { db } from "@/db";
import { customEmojis, members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  validateFileSignature,
  isSvgContent,
  MAX_EMOJI_SIZE,
  EMOJI_DIMENSIONS,
} from "@/lib/file-validation";

// CONTEXT: Names allow letters, numbers, underscores, and hyphens
const EMOJI_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const workspaceId = formData.get("workspaceId") as string | null;

    if (!file || !name || !workspaceId) {
      return NextResponse.json(
        { error: "File, name, and workspaceId required" },
        { status: 400 }
      );
    }

    // Validate emoji name format (CONTEXT decision)
    if (!EMOJI_NAME_REGEX.test(name) || name.length > 64) {
      return NextResponse.json(
        { error: "Invalid emoji name. Use letters, numbers, underscores, hyphens (max 64 chars)" },
        { status: 400 }
      );
    }

    // Validate file size (EMOJ-01: 128KB)
    if (file.size > MAX_EMOJI_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 128KB" },
        { status: 400 }
      );
    }

    // CONTEXT: Admins and channel creators can upload
    // Check if user is admin in workspace
    const membership = await db.query.members.findFirst({
      where: and(
        eq(members.userId, session.user.id),
        eq(members.organizationId, workspaceId)
      ),
      columns: { role: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of workspace" }, { status: 403 });
    }

    // For now, allow admin and member roles (creator check would need channel context)
    // Restricting to admin only for workspace-level emoji
    if (membership.role !== "admin" && membership.role !== "owner") {
      return NextResponse.json(
        { error: "Admin access required to upload emoji" },
        { status: 403 }
      );
    }

    // Check name uniqueness within workspace (EMOJ-04)
    const existing = await db.query.customEmojis.findFirst({
      where: and(
        eq(customEmojis.workspaceId, workspaceId),
        eq(customEmojis.name, name)
      ),
    });

    if (existing) {
      return NextResponse.json(
        { error: `Emoji :${name}: already exists` },
        { status: 400 }
      );
    }

    // Read and validate file
    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    const uint8 = new Uint8Array(arrayBuffer);

    // Explicit SVG blocking with security logging
    if (isSvgContent(uint8)) {
      console.warn('[Security] SVG emoji upload blocked:', {
        filename: file.name,
        emojiName: name,
        userId: session.user.id,
        workspaceId,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "SVG files are not allowed for security reasons" },
        { status: 400 }
      );
    }

    const validated = validateFileSignature(uint8);
    if (!validated || !["png", "jpg", "gif", "webp"].includes(validated.extension)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPG, GIF, WebP" },
        { status: 400 }
      );
    }

    const finalMimeType = validated.mimeType;
    const isAnimated = validated.extension === "gif"; // EMOJ-07

    // Resize all images to standard size
    const processed = await sharp(buffer, { animated: isAnimated })
      .resize(EMOJI_DIMENSIONS, EMOJI_DIMENSIONS, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();
    buffer = Buffer.from(processed);

    // Generate filename and save
    const extension = finalMimeType === "image/png" ? "png" :
                      finalMimeType === "image/gif" ? "gif" :
                      finalMimeType === "image/webp" ? "webp" : "jpg";
    const filename = `${uuid()}.${extension}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "emoji");
    const filepath = join(uploadDir, filename);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filepath, buffer);

    const path = `/uploads/emoji/${filename}`;

    // Insert into database
    const [emoji] = await db
      .insert(customEmojis)
      .values({
        workspaceId,
        name,
        filename,
        path,
        mimeType: finalMimeType,
        sizeBytes: buffer.length,
        isAnimated,
        uploadedBy: session.user.id,
      })
      .returning();

    return NextResponse.json({
      id: emoji.id,
      name: emoji.name,
      path: emoji.path,
      isAnimated: emoji.isAnimated,
    });
  } catch (error) {
    console.error("Emoji upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload emoji" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { db } from "@/db";
import { fileAttachments } from "@/db/schema";
import {
  validateFileSignature,
  isSvgContent,
  MAX_FILE_SIZE,
} from "@/lib/file-validation";
import { checkQuota, updateUsage } from "@/lib/security/storage-quota";
import { errorResponse } from "@/app/api/error-handling";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size first (FILE-06: 25MB limit)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 25MB" },
        { status: 400 }
      );
    }

    // Check storage quota (SEC2-10: per-user storage limits)
    const quotaCheck = await checkQuota(session.user.id, file.size);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: "Storage quota exceeded",
          details: {
            currentUsage: quotaCheck.currentUsage,
            quota: quotaCheck.quota,
            percentUsed: quotaCheck.percentUsed,
          },
        },
        { status: 413 } // Payload Too Large
      );
    }

    // Read file bytes for signature validation
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Explicit SVG blocking with security logging
    if (isSvgContent(uint8)) {
      console.warn('[Security] SVG upload blocked:', {
        filename: file.name,
        userId: session.user.id,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "SVG files are not allowed for security reasons" },
        { status: 400 }
      );
    }

    // Validate file signature (magic bytes) - don't trust client MIME type (FILE-07)
    const validated = validateFileSignature(uint8);
    if (!validated) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Allowed types: JPEG, PNG, GIF, WebP, PDF",
        },
        { status: 400 }
      );
    }

    // Generate unique filename with validated extension (not client-provided)
    const filename = `${uuid()}.${validated.extension}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "attachments");
    const filepath = join(uploadDir, filename);

    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true });

    // Write file to disk (bytes already read above for validation)
    await writeFile(filepath, Buffer.from(arrayBuffer));

    // Path to store in database (public URL path)
    const path = `/uploads/attachments/${filename}`;

    // Insert attachment metadata into database
    const [attachment] = await db
      .insert(fileAttachments)
      .values({
        filename,
        originalName: file.name,
        mimeType: validated.mimeType,
        sizeBytes: file.size,
        path,
        isImage: validated.isImage,
        uploadedBy: session.user.id,
      })
      .returning();

    // Update user storage usage
    await updateUsage(session.user.id, file.size);

    return NextResponse.json({
      id: attachment.id,
      path: attachment.path,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      isImage: attachment.isImage,
      quotaWarning: quotaCheck.showWarning,
      quotaPercentUsed: quotaCheck.percentUsed,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

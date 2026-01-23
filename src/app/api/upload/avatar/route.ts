import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/app/api/error-handling";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Validate file signature (magic bytes) and return detected extension.
 * Returns null if file signature doesn't match any allowed image type.
 */
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

    // Read file bytes for signature validation
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Validate file signature (magic bytes) - don't trust client MIME type
    const validatedExtension = validateFileSignature(uint8);
    if (!validatedExtension) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. File signature doesn't match allowed image types (JPEG, PNG, WebP, GIF)",
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 2MB" },
        { status: 400 }
      );
    }

    // Generate unique filename with validated extension (not client-provided)
    const filename = `${uuid()}.${validatedExtension}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "avatars");
    const filepath = join(uploadDir, filename);

    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true });

    // Write file to disk (bytes already read above for validation)
    await writeFile(filepath, Buffer.from(arrayBuffer));

    // Path to store in database (public URL path)
    const avatarPath = `/uploads/avatars/${filename}`;

    // Upsert profile with new avatar
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    });

    if (existingProfile) {
      await db
        .update(profiles)
        .set({ avatarPath, updatedAt: new Date() })
        .where(eq(profiles.userId, session.user.id));
    } else {
      await db.insert(profiles).values({
        userId: session.user.id,
        avatarPath,
      });
    }

    return NextResponse.json({ avatarPath });
  } catch (error) {
    return errorResponse(error);
  }
}

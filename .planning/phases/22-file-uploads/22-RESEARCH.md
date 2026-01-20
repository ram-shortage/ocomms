# Phase 22: File Uploads - Research

**Researched:** 2026-01-20
**Domain:** File attachments for messages (channels and DMs)
**Confidence:** HIGH

## Summary

Phase 22 implements file attachments for OComms messages. Users can drag-and-drop, click-to-browse, or paste from clipboard to upload files up to 25MB. Images display inline as previews; other files display as download links with filename and size.

The project already has a proven file upload pattern via the avatar upload system (`/api/upload/avatar`), which validates files using magic bytes, stores to local disk, and uses UUID-based filenames. This phase extends that pattern for general message attachments.

Key findings:
1. **Extend existing avatar upload pattern** - The magic bytes validation, local disk storage, and UUID filenames are already proven. Extend, don't replace.
2. **No external upload library needed** - Native FormData API and drag-and-drop events work fine. The v0.4.0 research explicitly recommends against react-dropzone due to React 19 peer dependency issues.
3. **Database schema addition** - New `file_attachments` table linked to messages via `message_id`
4. **Upload via HTTP, display via Socket.IO** - Upload files via API route, then reference attachment IDs in message content sent via Socket.IO

**Primary recommendation:** Extend the existing avatar upload route pattern to create `/api/upload/attachment` with the same magic bytes validation, larger size limit (25MB), and new `file_attachments` table for metadata storage.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native FormData API | Built-in | File handling | Already working in avatar upload. Project research explicitly recommends this over external libraries. |
| UUID (uuid package) | ^13.0.0 | Filename generation | Already in dependencies. Prevents path traversal and collision. |
| fs/promises | Built-in | File I/O | Node.js native, async/await API |
| Next.js App Router | ^16.1.3 | API routes | Project stack, handles multipart forms |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.562.0 | File type icons | Already installed. Use Paperclip, Image, FileText, File icons |
| date-fns | ^4.1.0 | Timestamp display | Already installed. Format upload dates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native drag-drop | react-dropzone | React 19 peer dep issues, needs --legacy-peer-deps. Native works fine. |
| Local disk | MinIO/S3 | Violates self-hosted simplicity. Project explicitly uses local storage. |
| Native FormData | formidable/busboy | Streaming overkill for 25MB. Native API simpler in App Router. |
| Native FormData | UploadThing | External SaaS. Violates self-hosted requirement. |

**Installation:**
```bash
# No new dependencies needed for file uploads
# All required packages already in project:
# - uuid (filename generation)
# - lucide-react (icons)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       └── upload/
│           ├── avatar/
│           │   └── route.ts        # Existing (extend pattern from here)
│           └── attachment/
│               └── route.ts        # New: general file uploads
├── components/
│   └── message/
│       ├── message-input.tsx       # Modify: add file upload UI
│       ├── file-upload-zone.tsx    # New: drag-drop component
│       ├── upload-progress.tsx     # New: progress indicator
│       ├── file-attachment.tsx     # New: display attachment in message
│       └── image-preview.tsx       # New: inline image preview
├── db/
│   └── schema/
│       └── file-attachment.ts      # New: attachment schema
├── lib/
│   └── file-validation.ts          # New: shared magic bytes validation
└── public/
    └── uploads/
        ├── avatars/                # Existing
        └── attachments/            # New: message attachments
```

### Pattern 1: File Upload API Route
**What:** HTTP POST endpoint that validates and stores files
**When to use:** All file uploads (avatar, message attachments)
**Example:**
```typescript
// Source: Existing avatar upload pattern from /src/app/api/upload/avatar/route.ts
export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Parse form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  // 3. Read bytes for validation
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // 4. Validate magic bytes (not MIME type)
  const validated = validateFileSignature(uint8);
  if (!validated) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });

  // 5. Validate size
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large" }, { status: 400 });

  // 6. Generate secure filename
  const filename = `${uuid()}.${validated.extension}`;

  // 7. Store to disk
  const uploadDir = join(process.cwd(), "public", "uploads", "attachments");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), Buffer.from(arrayBuffer));

  // 8. Store metadata in DB
  const [attachment] = await db.insert(fileAttachments).values({
    filename,
    originalName: file.name,
    mimeType: validated.mimeType,
    sizeBytes: file.size,
    path: `/uploads/attachments/${filename}`,
    uploadedBy: session.user.id,
  }).returning();

  return NextResponse.json({ attachment });
}
```

### Pattern 2: Native Drag-and-Drop
**What:** Browser drag-and-drop events without external libraries
**When to use:** File drop zones
**Example:**
```typescript
// Source: Native HTML5 Drag and Drop API
function FileDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    onFiles(files);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-lg p-4 transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-gray-300"
      )}
    >
      {isDragging ? "Drop files here" : "Drag files or click to browse"}
    </div>
  );
}
```

### Pattern 3: Clipboard Paste Upload
**What:** Handle Ctrl/Cmd+V to paste images
**When to use:** Message input when user pastes clipboard content
**Example:**
```typescript
// Source: Clipboard API MDN documentation
const handlePaste = async (e: React.ClipboardEvent) => {
  const items = e.clipboardData.items;
  const files: File[] = [];

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  if (files.length > 0) {
    e.preventDefault(); // Prevent default paste behavior
    onFilesSelected(files);
  }
};

// In message input component
<Textarea
  onPaste={handlePaste}
  // ... other props
/>
```

### Pattern 4: Upload Progress with XHR
**What:** Track upload progress percentage
**When to use:** Large file uploads (> few KB)
**Example:**
```typescript
// Source: XMLHttpRequest progress events
function uploadFile(
  file: File,
  onProgress: (percent: number) => void
): Promise<{ attachment: Attachment }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText || "Upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));

    xhr.open("POST", "/api/upload/attachment");
    xhr.send(formData);
  });
}
```

### Anti-Patterns to Avoid
- **Trusting MIME type:** Never trust `file.type` - validate magic bytes instead
- **Using client-provided filename:** Always generate UUID-based names to prevent path traversal
- **Storing in webroot without auth:** Serve files through authenticated routes if privacy needed (though public uploads for chat is acceptable)
- **Streaming for small files:** 25MB fits in memory; streaming adds complexity without benefit
- **External upload services:** Breaks self-hosted value proposition

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File type detection | MIME type check | Magic bytes validation | MIME can be spoofed. Existing avatar upload already does this correctly. |
| Drag-drop library | Custom drop zone from scratch | Native HTML5 drag-drop events | Simpler, no dependencies, works everywhere |
| File upload UI | Build complex uploader | Extend message-input with drop zone | Keep UI consistent with existing patterns |
| Progress indicator | Custom progress bar | Radix Progress component | Already using Radix. Use @radix-ui/react-progress (already in deps) |
| Image preview | Custom image viewer | Next.js Image component | Already using next/image, handles optimization |

**Key insight:** The avatar upload system is already a complete, secure file upload implementation. Extending it for attachments is straightforward; rebuilding would reintroduce solved problems.

## Common Pitfalls

### Pitfall 1: Trusting Client-Provided Data
**What goes wrong:** Accepting filename from client leads to path traversal (../../etc/passwd); trusting MIME type allows HTML/JS upload disguised as image
**Why it happens:** Convenience - client provides both values, easy to use directly
**How to avoid:**
- Generate UUID filename server-side (existing pattern does this)
- Validate magic bytes, ignore MIME type (existing pattern does this)
- Use extension from validated type, not client file name
**Warning signs:** Using `file.name` in file path; checking `file.type` instead of bytes

### Pitfall 2: Missing Progress Feedback
**What goes wrong:** Users think upload failed on large files; click multiple times; close browser
**Why it happens:** Using fetch() which doesn't expose upload progress events
**How to avoid:** Use XMLHttpRequest for uploads (has upload.progress event) or show indeterminate spinner
**Warning signs:** Using fetch() for file uploads without progress UI

### Pitfall 3: Not Handling Upload Cancellation
**What goes wrong:** User can't cancel a slow upload; half-uploaded files remain on disk
**Why it happens:** No abort controller or cleanup logic
**How to avoid:**
- Use AbortController with XHR/fetch
- Clean up partial uploads on error
- Provide visible cancel button during upload
**Warning signs:** No cancel UI; no cleanup on error

### Pitfall 4: Blocking Message Send on Upload
**What goes wrong:** User can't send text message while file is uploading
**Why it happens:** Coupling file upload to message send flow
**How to avoid:**
- Upload file first, get attachment ID
- Attach ID to message content
- Allow message send with pending uploads
**Warning signs:** Single submit button for both message and file

### Pitfall 5: Not Validating in Message Handler
**What goes wrong:** User includes invalid attachment ID in message; message saved with broken reference
**Why it happens:** Trusting client-provided attachment IDs
**How to avoid:** Validate that attachment ID exists and belongs to user before associating with message
**Warning signs:** Directly using attachment ID from client without lookup

### Pitfall 6: Missing Membership Check on File Serve
**What goes wrong:** Anyone with file URL can access attachments from private channels
**Why it happens:** Files in /public are served without auth
**How to avoid:** For sensitive files, serve through authenticated API route with membership check
**Warning signs:** All attachments in public/ without access control consideration

## Code Examples

Verified patterns from existing codebase and official sources:

### Magic Bytes Validation (Extended)
```typescript
// Source: Existing /src/app/api/upload/avatar/route.ts - extended for more types
// FILE-07: Validate via magic bytes, not just extension

interface ValidatedFile {
  extension: string;
  mimeType: string;
  isImage: boolean;
}

function validateFileSignature(bytes: Uint8Array): ValidatedFile | null {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg", isImage: true };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return { extension: "png", mimeType: "image/png", isImage: true };
  }

  // GIF: 47 49 46 38 (37|39) 61 (GIF87a or GIF89a)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return { extension: "gif", mimeType: "image/gif", isImage: true };
  }

  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { extension: "webp", mimeType: "image/webp", isImage: true };
  }

  // PDF: %PDF (25 50 44 46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { extension: "pdf", mimeType: "application/pdf", isImage: false };
  }

  // ZIP/DOCX/XLSX/PPTX: PK (50 4B 03 04)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    // ZIP-based formats - use extension hint from original name for MIME
    return { extension: "zip", mimeType: "application/zip", isImage: false };
  }

  // Legacy Office DOC/XLS/PPT: D0 CF 11 E0 A1 B1 1A E1
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1) {
    return { extension: "doc", mimeType: "application/msword", isImage: false };
  }

  return null; // Unknown or disallowed type
}
```

### Database Schema for Attachments
```typescript
// Source: Project Drizzle ORM patterns from /src/db/schema/
import { pgTable, uuid, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { messages } from "./message";
import { users } from "./auth";

export const fileAttachments = pgTable("file_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(), // UUID-based name on disk
  originalName: varchar("original_name", { length: 255 }).notNull(), // User's original filename
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  path: varchar("path", { length: 500 }).notNull(), // URL path to file
  isImage: boolean("is_image").notNull().default(false),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fileAttachmentsRelations = relations(fileAttachments, ({ one }) => ({
  message: one(messages, {
    fields: [fileAttachments.messageId],
    references: [messages.id],
  }),
  uploader: one(users, {
    fields: [fileAttachments.uploadedBy],
    references: [users.id],
  }),
}));
```

### File Attachment Display Component
```typescript
// Source: Project component patterns, existing message-item.tsx
"use client";

import Image from "next/image";
import { FileText, File, Download } from "lucide-react";
import { formatBytes } from "@/lib/format";

interface FileAttachmentProps {
  attachment: {
    id: string;
    originalName: string;
    path: string;
    mimeType: string;
    sizeBytes: number;
    isImage: boolean;
  };
}

export function FileAttachment({ attachment }: FileAttachmentProps) {
  // FILE-04: Images display inline preview
  if (attachment.isImage) {
    return (
      <div className="mt-2 max-w-md rounded-lg overflow-hidden border">
        <a href={attachment.path} target="_blank" rel="noopener noreferrer">
          <Image
            src={attachment.path}
            alt={attachment.originalName}
            width={400}
            height={300}
            className="object-contain"
            style={{ maxHeight: "300px", width: "auto" }}
          />
        </a>
      </div>
    );
  }

  // FILE-05: Non-images display as download link
  return (
    <a
      href={attachment.path}
      download={attachment.originalName}
      className="mt-2 flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 max-w-md"
    >
      <FileIcon mimeType={attachment.mimeType} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.originalName}</p>
        <p className="text-xs text-gray-500">{formatBytes(attachment.sizeBytes)}</p>
      </div>
      <Download className="h-4 w-4 text-gray-400" />
    </a>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("application/pdf")) {
    return <FileText className="h-8 w-8 text-red-500" />;
  }
  return <File className="h-8 w-8 text-gray-400" />;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
```

### Upload Progress Component
```typescript
// Source: Radix Progress component (already in deps)
"use client";

import * as Progress from "@radix-ui/react-progress";
import { X } from "lucide-react";

interface UploadProgressProps {
  filename: string;
  progress: number;
  onCancel?: () => void;
}

export function UploadProgress({ filename, progress, onCancel }: UploadProgressProps) {
  return (
    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{filename}</p>
        <Progress.Root
          className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200"
          value={progress}
        >
          <Progress.Indicator
            className="h-full bg-blue-500 transition-transform duration-200"
            style={{ transform: `translateX(-${100 - progress}%)` }}
          />
        </Progress.Root>
      </div>
      <span className="text-xs text-gray-500">{progress}%</span>
      {onCancel && (
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-200 rounded"
          aria-label="Cancel upload"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MIME type validation | Magic bytes validation | Always best practice | MIME can be spoofed; magic bytes reliable |
| Synchronous FileReader | ArrayBuffer API | ES2017+ | Cleaner async/await code |
| FormData + fetch (no progress) | XHR with upload progress | Always available | fetch() still can't track upload progress |
| External upload libraries | Native APIs | React 19 | Peer dependency issues with react-dropzone |

**Deprecated/outdated:**
- `react-dropzone` with React 19: Has peer dependency issues, requires --legacy-peer-deps
- `formidable`/`busboy` in App Router: Native FormData works better in modern Next.js
- MIME type-only validation: Never secure; always validate magic bytes

## Open Questions

Things that couldn't be fully resolved:

1. **Multi-file upload limit per message**
   - What we know: Slack allows 10 files per drop
   - What's unclear: Should OComms limit to same number? Per-upload or per-message?
   - Recommendation: Start with 5 files per upload, can increase later

2. **Attachment cleanup on message deletion**
   - What we know: Message deletion cascades to attachment DB record (ON DELETE CASCADE)
   - What's unclear: Should we delete files from disk too? Background job?
   - Recommendation: For v1, leave orphaned files; add cleanup cron later if needed

3. **File access control**
   - What we know: Files in /public are served without auth
   - What's unclear: Should attachments in private channels be protected?
   - Recommendation: Start with public URLs (simple); add auth-protected serving later if needed

## Sources

### Primary (HIGH confidence)
- Existing avatar upload implementation: `/src/app/api/upload/avatar/route.ts` - Proven pattern in production
- Existing avatar upload tests: `/src/app/api/upload/avatar/__tests__/route.test.ts` - Test coverage example
- Project v0.4.0 research: `.planning/research/STACK-v0.4.0.md` - Technology decisions
- Project v0.4.0 features: `.planning/research/FEATURES-v0.4.0.md` - Feature requirements

### Secondary (MEDIUM confidence)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) - Security guidelines
- [react-dropzone GitHub](https://github.com/react-dropzone/react-dropzone) - API reference (not recommended due to React 19 issues)
- [MDN Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API) - Native drag-drop events
- [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) - Paste handling
- [Wikipedia: List of file signatures](https://en.wikipedia.org/wiki/List_of_file_signatures) - Magic bytes reference

### Tertiary (LOW confidence)
- [Medium: Building Drag-and-Drop File Uploader with Next.js](https://medium.com/@codewithmarish/building-a-drag-and-drop-file-uploader-with-next-js-1cfaf504f8ea) - General patterns
- [WebSearch: React file upload progress 2025](https://dev.to/bmvantunes/react-file-upload-with-drag-n-drop-and-progress-bar-2k0m) - Progress indicator examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Extending proven existing pattern, no new dependencies
- Architecture: HIGH - Patterns from existing codebase and official APIs
- Pitfalls: HIGH - Based on existing implementation and OWASP guidelines
- Security: HIGH - Magic bytes validation already implemented and tested

**Research date:** 2026-01-20
**Valid until:** 60 days (stable patterns, no external dependencies)

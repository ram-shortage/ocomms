# Technology Stack: v0.4.0 Features

**Project:** OComms - Self-Hosted Real-Time Team Chat Platform
**Milestone:** v0.4.0 - File Uploads, Dark Mode, Collaborative Notes
**Researched:** 2026-01-20
**Confidence Level:** HIGH

---

## Executive Summary

For v0.4.0 features (file uploads, theme switching, markdown notes), the recommended approach leverages the existing stack while adding minimal new dependencies:

- **File Uploads:** Native FormData API with magic bytes validation (no external upload library needed)
- **Theme Switching:** `next-themes` library (de facto standard for Next.js)
- **Markdown Notes:** `react-markdown` v10 + `DOMPurify` for viewing; simple textarea for editing

The project already has a working avatar upload pattern using native APIs. Extending this for general file attachments is the simplest path forward.

---

## File Uploads

### Recommended Stack

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Native FormData API** | Built-in | File handling | Already working in avatar upload. No external library needed for 25MB files. |
| **Custom magic bytes validation** | - | File type validation | Already implemented. Extend for additional file types. |
| **Local disk storage** | - | File storage | Project requirement. Use `public/uploads/` with subdirectories per type. |
| **nanoid** | 5.x | Filename generation | Already in dependencies. Secure, URL-safe IDs. |

### What NOT to Use

| Technology | Why Not |
|------------|---------|
| **formidable** | Overkill for simple uploads. Native FormData works fine in App Router. Adds complexity without benefit. |
| **busboy** | Only needed for streaming large files. 25MB fits in memory easily. Native API simpler. |
| **multer** | Express middleware pattern. Doesn't fit Next.js App Router. |
| **UploadThing** | External SaaS. Violates self-hosted requirement. |
| **react-dropzone** | React 19 compatibility issues (requires `--legacy-peer-deps`). The native drag-drop API works fine. |
| **MinIO** | Project explicitly uses local disk storage. MinIO adds unnecessary complexity. |

### File Validation Strategy

**Extend existing magic bytes validation:**

```typescript
// Already exists in /src/app/api/upload/avatar/route.ts
// Extend for additional file types:

const FILE_SIGNATURES = {
  // Images (already implemented)
  jpg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  gif: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  webp: [[0x52, 0x49, 0x46, 0x46], /* offset 8: */ [0x57, 0x45, 0x42, 0x50]],

  // Documents
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF

  // Archives
  zip: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]], // PK

  // Text files: validate by extension + content check (no binary)
};
```

**Rationale:** Magic bytes validation is more secure than MIME type checking (which can be spoofed). The existing implementation already does this correctly.

### Upload Architecture

```
uploads/
  avatars/     # User profile pictures (existing)
  attachments/ # Message file attachments (new)
  notes/       # Note attachments if needed (new)
```

**File size limits by type:**
- Images: 10MB (reasonable for screenshots, photos)
- Documents: 25MB (project requirement)
- All files: virus scanning recommended for production

### Database Schema Addition

```sql
-- New table for file attachments
CREATE TABLE file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  path VARCHAR(500) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CHECK (message_id IS NOT NULL OR note_id IS NOT NULL)
);
```

### Sources

- Existing implementation: `/src/app/api/upload/avatar/route.ts`
- [Next.js App Router file handling](https://github.com/vercel/next.js/discussions/48164)
- [Magic bytes validation](https://medium.com/@nir.almog90/detect-validate-file-types-by-their-magic-numbers-in-react-f7f44bd45187)

**Confidence:** HIGH - Extending proven existing pattern.

---

## Theme Switching (Dark Mode)

### Recommended Stack

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **next-themes** | ^0.4.6 | Theme provider | De facto standard for Next.js. Handles SSR hydration, system preference, no flashing. 2,172 dependent packages. |

### What NOT to Use

| Technology | Why Not |
|------------|---------|
| **Custom context** | Reinventing the wheel. next-themes handles edge cases (hydration, system preference sync, tab sync). |
| **CSS media queries only** | Can't persist user preference. System preference only. |
| **localStorage raw** | Causes flash of wrong theme on page load. |

### Implementation

The project already has dark mode CSS variables defined in `globals.css`:

```css
/* Already exists */
@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  /* ... light theme variables */
}

.dark {
  --background: oklch(0.145 0 0);
  /* ... dark theme variables */
}
```

**Add next-themes:**

```bash
npm install next-themes
```

**ThemeProvider setup:**

```tsx
// src/components/providers/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

**Root layout:**

```tsx
// src/app/layout.tsx
<html lang="en" suppressHydrationWarning>
  <body>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </body>
</html>
```

**Theme toggle component:**

```tsx
// src/components/theme-toggle.tsx
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectItem value="light"><Sun /> Light</SelectItem>
      <SelectItem value="dark"><Moon /> Dark</SelectItem>
      <SelectItem value="system"><Monitor /> System</SelectItem>
    </Select>
  );
}
```

### Features Included

- **No flash:** Script runs before React hydration
- **System preference:** Respects `prefers-color-scheme`
- **Tab sync:** Theme changes sync across tabs
- **Persistence:** Stores in localStorage
- **SSR compatible:** Works with Next.js App Router

### Sources

- [next-themes GitHub](https://github.com/pacocoursey/next-themes)
- [shadcn/ui dark mode guide](https://ui.shadcn.com/docs/dark-mode/next)
- [Next.js 15 dark mode setup](https://dev.to/darshan_bajgain/setting-up-2025-nextjs-15-with-shadcn-tailwind-css-v4-no-config-needed-dark-mode-5kl)

**Confidence:** HIGH - Industry standard, excellent documentation.

---

## Markdown Notes

### Recommended Stack

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **react-markdown** | ^10.1.0 | Markdown rendering | React-native rendering (no dangerouslySetInnerHTML). Supports async plugins. React 19 compatible (v9.0.2 fixed types). |
| **DOMPurify** | ^3.3.x | XSS sanitization | Security standard for HTML sanitization. Works with rehype-raw if needed. |
| **remark-gfm** | ^4.x | GitHub Flavored Markdown | Tables, strikethrough, task lists, autolinks. |
| **rehype-highlight** | ^7.x | Syntax highlighting | Code block highlighting for technical notes. |

### What NOT to Use

| Technology | Why Not |
|------------|---------|
| **MDXEditor** | 851KB gzipped. Overkill for notes feature. Known inline rendering issues. |
| **Tiptap** | React 19 compatibility still in progress. Complex for markdown-only use case. Better for rich text WYSIWYG. |
| **Lexical** | Low-level framework. Requires significant setup. Overkill for simple notes. |
| **marked** | Returns raw HTML string. Requires dangerouslySetInnerHTML. |
| **markdown-it** | Same issue as marked. react-markdown is React-native. |

### Implementation Strategy

**Simple editing approach:** Use a plain textarea for editing markdown. This is:
- Simpler to implement
- More accessible
- Familiar to developers/power users
- Avoids WYSIWYG complexity

**Preview mode:** Toggle between edit (textarea) and preview (react-markdown).

```tsx
// Note editor component
"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface NoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  mode: "edit" | "preview";
}

export function NoteEditor({ content, onChange, mode }: NoteEditorProps) {
  if (mode === "edit") {
    return (
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full font-mono text-sm"
        placeholder="Write your note in Markdown..."
      />
    );
  }

  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className="prose dark:prose-invert"
    >
      {content}
    </Markdown>
  );
}
```

### Security Considerations

**react-markdown is safe by default:**
- Renders to React components, not HTML strings
- No `dangerouslySetInnerHTML`
- XSS prevention built-in

**If allowing raw HTML (not recommended):**
```tsx
import rehypeRaw from "rehype-raw";
import DOMPurify from "dompurify";

// Sanitize before rendering
const sanitizedContent = DOMPurify.sanitize(content);

<Markdown
  rehypePlugins={[rehypeRaw]}
>
  {sanitizedContent}
</Markdown>
```

**Recommendation:** Don't enable raw HTML. Markdown is sufficient for notes.

### URL Validation

```tsx
// Prevent javascript: URLs
<Markdown
  urlTransform={(url) => {
    if (url.startsWith("javascript:")) return "";
    return url;
  }}
>
  {content}
</Markdown>
```

### Database Schema

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_pinned BOOLEAN DEFAULT FALSE
);

-- For collaborative editing, add version tracking
CREATE TABLE note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Sources

- [react-markdown changelog](https://github.com/remarkjs/react-markdown/blob/main/changelog.md)
- [React Markdown security guide](https://strapi.io/blog/react-markdown-complete-guide-security-styling)
- [DOMPurify](https://github.com/cure53/DOMPurify)
- [Secure markdown rendering](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety)

**Confidence:** HIGH - Well-documented, widely used libraries.

---

## Installation Summary

```bash
# Theme switching
npm install next-themes

# Markdown rendering
npm install react-markdown remark-gfm rehype-highlight

# Security (only if allowing raw HTML in markdown)
npm install dompurify rehype-raw
npm install -D @types/dompurify

# File uploads - no new dependencies needed
# (uses existing: nanoid, fs/promises)
```

### Bundle Size Impact

| Package | Gzipped Size | Notes |
|---------|--------------|-------|
| next-themes | ~2KB | Minimal |
| react-markdown | ~8KB | Core only |
| remark-gfm | ~4KB | GFM support |
| rehype-highlight | ~25KB | Includes highlight.js subset |
| dompurify | ~7KB | Only if needed |

**Total new bundle:** ~40KB (or ~15KB without syntax highlighting)

---

## Version Compatibility Matrix

| Package | Version | React 19 | Next.js 15 | Notes |
|---------|---------|----------|------------|-------|
| next-themes | 0.4.6 | Yes | Yes | Stable |
| react-markdown | 10.1.0 | Yes | Yes | v9.0.2 fixed React 19 types |
| remark-gfm | 4.x | Yes | Yes | Via react-markdown |
| rehype-highlight | 7.x | Yes | Yes | Via react-markdown |
| dompurify | 3.x | Yes | N/A | Pure JS, no React dependency |

---

## Alternatives Considered

### File Uploads

| Option | Verdict | Reasoning |
|--------|---------|-----------|
| Native FormData | **RECOMMENDED** | Already working. Simple. No dependencies. |
| react-dropzone | Not recommended | React 19 peer dependency issues. Native drag-drop works. |
| UploadThing | Rejected | External SaaS. Violates self-hosted. |
| formidable/busboy | Not needed | 25MB files fit in memory. Streaming overkill. |

### Theme Switching

| Option | Verdict | Reasoning |
|--------|---------|-----------|
| next-themes | **RECOMMENDED** | Standard solution. Handles all edge cases. |
| Custom context | Not recommended | Reinvents wheel. Missing flash prevention. |
| CSS only | Rejected | Can't persist preference. System only. |

### Markdown

| Option | Verdict | Reasoning |
|--------|---------|-----------|
| react-markdown + textarea | **RECOMMENDED** | Simple, secure, accessible. |
| Tiptap | Considered | Good for WYSIWYG. React 19 issues. Complex. |
| MDXEditor | Rejected | 851KB. Overkill. Known issues. |
| Lexical | Rejected | Too low-level for simple notes. |

---

## Roadmap Implications

### Phase Structure Recommendation

**File Uploads (2-3 days):**
1. Extend existing upload route for attachments
2. Add file_attachments table
3. Add upload UI to message composer
4. Display attachments in messages

**Dark Mode (1 day):**
1. Install next-themes
2. Add ThemeProvider to layout
3. Add theme toggle to settings
4. Test all components in both modes

**Notes Feature (3-5 days):**
1. Create notes table schema
2. Build note list view
3. Build note editor (textarea + preview)
4. Add channel-level note access
5. Add version history (optional)

### Dependencies Between Features

```
File Uploads ──┐
               ├──> Notes can have attachments
Dark Mode ─────┤
               └──> All features need dark mode styling
```

**Build order:** Dark Mode first (affects all UI), then File Uploads (simpler), then Notes (most complex).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| File Uploads | HIGH | Extending proven existing pattern |
| Theme Switching | HIGH | next-themes is industry standard |
| Markdown Rendering | HIGH | react-markdown well-documented |
| React 19 Compatibility | HIGH | All recommended packages verified |
| Bundle Size | HIGH | Measured from npm |

---

## Open Questions for Implementation

1. **File cleanup:** How to handle orphaned files (uploaded but message deleted)?
2. **Note permissions:** Channel-level or per-note access control?
3. **Collaborative editing:** Real-time sync via Socket.IO or optimistic locking?
4. **Note search:** Include notes in existing search, or separate?

These are implementation decisions, not technology choices.

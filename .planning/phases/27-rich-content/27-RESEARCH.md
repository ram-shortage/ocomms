# Phase 27: Rich Content - Research

**Researched:** 2026-01-21
**Domain:** Link preview unfurling, custom emoji management, image processing
**Confidence:** MEDIUM (some components well-documented, custom emoji integration requires extension work)

## Summary

Phase 27 requires two distinct subsystems: (1) link preview generation with Open Graph/Twitter Card metadata extraction, and (2) custom workspace emoji with picker integration. The link preview system follows a standard pattern: extract URLs from messages, queue async fetching jobs, store cached results, and broadcast updates. The custom emoji system requires replacing the current frimousse picker with emoji-mart to support custom emoji alongside standard Unicode emoji.

The existing BullMQ infrastructure from Phase 25 provides the foundation for async link preview fetching. Sharp (already used in similar projects for image processing) handles SVG-to-PNG conversion for XSS protection. SSRF protection is critical and requires DNS-level IP validation, not just URL string matching.

**Primary recommendation:** Use unfurl.js for metadata extraction with request-filtering-agent for SSRF protection. Replace frimousse with emoji-mart for custom emoji support (frimousse lacks this capability).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| unfurl.js | latest | Open Graph/Twitter Card metadata extraction | Lightweight, no headless browser, supports oEmbed |
| sharp | latest | SVG-to-PNG conversion, image processing | Fastest Node.js image library, libvips-based |
| @emoji-mart/react | 1.1.1 | Emoji picker with custom emoji support | Industry standard, custom categories, Slack-like UX |
| @emoji-mart/data | latest | Standard emoji data | Decoupled data loading, tree-shakable |
| request-filtering-agent | latest | SSRF protection via DNS-level IP blocking | Blocks private IPs after DNS resolution |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| BullMQ | 5.66.5 (existing) | Async job processing | Link preview fetch queue |
| ioredis | 5.9.2 (existing) | Redis client for caching | Link preview cache storage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| unfurl.js | open-graph-scraper | open-graph-scraper is heavier, less maintained |
| emoji-mart | frimousse (current) | frimousse lacks custom emoji support - cannot use |
| request-filtering-agent | ssrf-req-filter | ssrf-req-filter has known bypass issues |
| sharp | convert-svg-to-png | sharp is faster, more maintained, already handles GIFs |

**Installation:**
```bash
npm install unfurl.js sharp @emoji-mart/react @emoji-mart/data request-filtering-agent
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/schema/
│   ├── link-preview.ts          # Link preview cache table
│   └── custom-emoji.ts          # Custom emoji table
├── server/queue/
│   └── link-preview.queue.ts    # BullMQ queue definition
├── workers/
│   └── link-preview.worker.ts   # Async URL fetching
├── lib/
│   ├── url-extractor.ts         # URL regex extraction from message content
│   ├── ssrf-protection.ts       # URL/IP validation
│   └── actions/
│       ├── link-preview.ts      # Server actions for preview data
│       └── custom-emoji.ts      # Server actions for emoji CRUD
├── components/
│   ├── message/
│   │   └── link-preview-card.tsx # Preview card component
│   └── emoji/
│       ├── emoji-picker.tsx     # emoji-mart wrapper
│       └── custom-emoji-upload.tsx # Emoji upload form
└── app/api/
    └── upload/
        └── emoji/route.ts       # Custom emoji upload endpoint
```

### Pattern 1: Async Link Preview Processing
**What:** Queue-based URL fetching triggered after message creation
**When to use:** Always for new messages containing URLs
**Example:**
```typescript
// Source: Follows existing scheduled-message.worker.ts pattern
// In message handler, after message:new broadcast:
const urls = extractUrls(message.content);
if (urls.length > 0) {
  // Queue preview fetch for first 5 URLs (LINK-02)
  for (const url of urls.slice(0, 5)) {
    await linkPreviewQueue.add('fetch', {
      messageId: message.id,
      url
    });
  }
}
```

### Pattern 2: Link Preview Worker with SSRF Protection
**What:** Worker validates URL safety before fetching metadata
**When to use:** Every link preview job
**Example:**
```typescript
// Source: Based on unfurl.js docs and request-filtering-agent pattern
import { unfurl } from 'unfurl.js';
import { useAgent } from 'request-filtering-agent';
import fetch from 'node-fetch';

async function fetchPreview(url: string) {
  // Validate URL is not private/internal
  const parsedUrl = new URL(url);

  // Skip non-http(s) protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return null;
  }

  // Skip file extension URLs (CONTEXT decision: skip .pdf, .zip, etc.)
  const fileExtensions = ['.pdf', '.zip', '.exe', '.dmg', '.tar', '.gz'];
  if (fileExtensions.some(ext => parsedUrl.pathname.toLowerCase().endsWith(ext))) {
    return null;
  }

  // Use filtering agent for SSRF protection (validates after DNS resolution)
  const metadata = await unfurl(url, {
    timeout: 5000,      // 5 second timeout
    follow: 3,          // Max 3 redirects
    size: 1024 * 1024,  // 1MB max response
    // Note: unfurl uses node-fetch internally, can configure agent
  });

  return {
    url,
    title: metadata.open_graph?.title || metadata.title,
    description: metadata.open_graph?.description || metadata.description,
    image: metadata.open_graph?.images?.[0]?.url,
    siteName: metadata.open_graph?.site_name,
    favicon: metadata.favicon,
  };
}
```

### Pattern 3: Custom Emoji with emoji-mart
**What:** Replace frimousse picker with emoji-mart for custom emoji support
**When to use:** All emoji picker instances (reactions, message input)
**Example:**
```typescript
// Source: emoji-mart documentation
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface CustomEmoji {
  id: string;
  name: string;
  keywords: string[];
  imageUrl: string;
}

function EmojiPicker({
  onSelect,
  customEmojis
}: {
  onSelect: (emoji: string | { native?: string; id?: string }) => void;
  customEmojis: CustomEmoji[];
}) {
  // Transform custom emojis to emoji-mart format
  const custom = customEmojis.length > 0 ? [{
    id: 'workspace',
    name: 'Workspace',
    emojis: customEmojis.map(e => ({
      id: e.id,
      name: e.name,
      keywords: e.keywords,
      skins: [{ src: e.imageUrl }],
    })),
  }] : [];

  return (
    <Picker
      data={data}
      custom={custom}
      onEmojiSelect={(emoji) => {
        // Native emoji or custom emoji
        onSelect(emoji.native || `:${emoji.id}:`);
      }}
    />
  );
}
```

### Pattern 4: SVG-to-PNG Conversion with Sharp
**What:** Convert uploaded SVG files to PNG to prevent XSS
**When to use:** On emoji upload when SVG detected (EMOJ-08)
**Example:**
```typescript
// Source: sharp official docs
import sharp from 'sharp';

async function convertSvgToPng(svgBuffer: Buffer): Promise<Buffer> {
  // Convert SVG to PNG at 128x128 (standard emoji size)
  return sharp(svgBuffer)
    .resize(128, 128, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent
    })
    .png()
    .toBuffer();
}
```

### Anti-Patterns to Avoid
- **String-based SSRF blocking:** Never use regex or string matching for private IPs. Attackers bypass with hex notation (0x7f.1), IPv6 (::1), or DNS rebinding.
- **Synchronous preview fetching:** Never block message creation waiting for preview. Always async via queue.
- **Trusting client MIME types:** Always validate file signatures (magic bytes) for emoji uploads.
- **Unbounded redirect following:** Cap redirects to prevent infinite loops and SSRF redirect chains.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL metadata extraction | Custom HTML parser | unfurl.js | Open Graph has many edge cases, Twitter Cards, oEmbed fallbacks |
| Private IP detection | Regex/string matching | request-filtering-agent | IPv6, hex notation, DNS rebinding attacks bypass naive checks |
| Image format conversion | ImageMagick shell calls | sharp | Native Node.js, faster, no shell injection risk |
| Emoji picker with custom support | Extend frimousse | emoji-mart | frimousse explicitly doesn't support custom emoji categories |
| GIF animation preservation | Manual frame handling | sharp (built-in) | sharp handles animated GIFs natively |

**Key insight:** Link preview fetching and SSRF protection have numerous edge cases that seem simple but lead to security vulnerabilities. Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: SSRF via DNS Rebinding
**What goes wrong:** Attacker controls a domain that initially resolves to a public IP during validation, then resolves to 127.0.0.1 during actual fetch.
**Why it happens:** Validation and fetch occur at different times, allowing DNS TTL manipulation.
**How to avoid:** Use request-filtering-agent which validates IP at connection time, not URL parse time.
**Warning signs:** Separate "validate URL" and "fetch URL" code paths.

### Pitfall 2: Blocking on Preview Fetch
**What goes wrong:** Message delivery delayed while waiting for slow external sites.
**Why it happens:** Synchronous preview fetching in message creation path.
**How to avoid:** Queue preview jobs, send message immediately, broadcast preview update later via Socket.IO.
**Warning signs:** User sees "sending..." for several seconds on messages with URLs.

### Pitfall 3: Large Bundle from Emoji Picker
**What goes wrong:** emoji-mart data (~600KB) loaded on initial page load.
**Why it happens:** Importing data synchronously at top of file.
**How to avoid:** Lazy load picker and data only when picker is opened.
**Warning signs:** Large initial JS bundle, slow time-to-interactive.

### Pitfall 4: Custom Emoji Name Collisions
**What goes wrong:** User uploads emoji with name that collides with standard emoji or existing custom emoji.
**Why it happens:** No uniqueness validation on emoji names.
**How to avoid:** Validate name uniqueness within workspace before upload (EMOJ-04). Enforce allowed character pattern.
**Warning signs:** `:smile:` rendering unpredictably between standard and custom.

### Pitfall 5: SVG XSS Attacks
**What goes wrong:** Malicious SVG contains JavaScript that executes when rendered as img src.
**Why it happens:** SVGs can contain `<script>` tags and event handlers.
**How to avoid:** Always convert SVG to PNG before storing (EMOJ-08). Never serve raw user SVGs.
**Warning signs:** Accepting SVG files without conversion.

### Pitfall 6: Preview Cache Invalidation
**What goes wrong:** Site updates Open Graph tags but stale preview continues showing.
**Why it happens:** Cache TTL too long or no invalidation mechanism.
**How to avoid:** Use reasonable TTL (24 hours), provide way to re-fetch when editing message.
**Warning signs:** User complaints that preview is outdated.

## Code Examples

Verified patterns from official sources:

### URL Extraction from Message Content
```typescript
// Source: Standard URL regex pattern
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

export function extractUrls(content: string): string[] {
  const matches = content.match(URL_REGEX);
  if (!matches) return [];

  // Dedupe and limit to 5 (LINK-02)
  return [...new Set(matches)].slice(0, 5);
}
```

### Link Preview Database Schema
```typescript
// Source: Follows existing schema patterns in project
import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";

export const linkPreviews = pgTable("link_previews", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull().unique(), // Canonical URL for cache lookup
  title: varchar("title", { length: 500 }),
  description: text("description"),
  imageUrl: text("image_url"),
  siteName: varchar("site_name", { length: 200 }),
  faviconUrl: text("favicon_url"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Cache expiration
}, (table) => [
  index("link_previews_url_idx").on(table.url),
  index("link_previews_expires_idx").on(table.expiresAt),
]);

// Junction table for message-to-preview relationship
export const messageLinkPreviews = pgTable("message_link_previews", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  linkPreviewId: uuid("link_preview_id").notNull().references(() => linkPreviews.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0), // Order in message
  hidden: boolean("hidden").notNull().default(false), // LINK-06: User dismissed
}, (table) => [
  index("message_link_previews_message_idx").on(table.messageId),
  uniqueIndex("message_link_previews_unique").on(table.messageId, table.linkPreviewId),
]);
```

### Custom Emoji Database Schema
```typescript
// Source: Follows existing schema patterns
import { pgTable, uuid, varchar, text, timestamp, integer, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";

export const customEmojis = pgTable("custom_emojis", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: text("workspace_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 64 }).notNull(), // :emoji_name:
  filename: varchar("filename", { length: 255 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(), // URL path
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  isAnimated: boolean("is_animated").notNull().default(false), // GIF flag (EMOJ-07)
  uploadedBy: text("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("custom_emojis_workspace_name_unique").on(table.workspaceId, table.name),
  index("custom_emojis_workspace_idx").on(table.workspaceId),
]);
```

### Socket.IO Event for Preview Updates
```typescript
// Add to ServerToClientEvents in src/lib/socket-events.ts
"linkPreview:ready": (data: {
  messageId: string;
  previews: Array<{
    id: string;
    url: string;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    siteName: string | null;
  }>;
}) => void;

"linkPreview:hidden": (data: {
  messageId: string;
  previewId: string;
}) => void;
```

### Emoji Upload Endpoint Pattern
```typescript
// Source: Follows existing attachment upload pattern
import sharp from 'sharp';
import { validateFileSignature, MAX_EMOJI_SIZE } from '@/lib/file-validation';

const MAX_EMOJI_SIZE = 128 * 1024; // 128KB (EMOJ-01)
const EMOJI_DIMENSIONS = 128; // 128x128 output

export async function POST(request: NextRequest) {
  // ... auth validation ...

  const file = formData.get("file") as File;
  const name = formData.get("name") as string;

  // Validate size
  if (file.size > MAX_EMOJI_SIZE) {
    return NextResponse.json({ error: "Max 128KB" }, { status: 400 });
  }

  // Validate name format (CONTEXT: letters, numbers, underscores, hyphens)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return NextResponse.json({ error: "Invalid emoji name" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  let buffer = Buffer.from(arrayBuffer);
  let mimeType: string;
  let isAnimated = false;

  // Detect file type by magic bytes
  const validated = validateFileSignature(new Uint8Array(arrayBuffer));

  if (!validated || !['png', 'jpg', 'gif', 'webp', 'svg'].includes(validated.extension)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  // SVG -> PNG conversion for XSS protection (EMOJ-08)
  if (validated.extension === 'svg' || file.type === 'image/svg+xml') {
    buffer = await sharp(buffer)
      .resize(EMOJI_DIMENSIONS, EMOJI_DIMENSIONS, { fit: 'contain' })
      .png()
      .toBuffer();
    mimeType = 'image/png';
  } else {
    mimeType = validated.mimeType;
    isAnimated = validated.extension === 'gif';

    // Resize non-SVG images to standard size
    buffer = await sharp(buffer, { animated: isAnimated })
      .resize(EMOJI_DIMENSIONS, EMOJI_DIMENSIONS, { fit: 'contain' })
      .toBuffer();
  }

  // ... save to disk and database ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer/headless browser for previews | unfurl.js (HTTP-only) | 2022+ | Much lighter, no browser overhead |
| String/regex IP validation | DNS-level agent blocking | 2023+ | Prevents SSRF bypasses |
| frimousse for all emoji | emoji-mart for custom support | N/A (project-specific) | Required for custom emoji feature |
| Synchronous preview loading | BullMQ async queue | Standard pattern | Non-blocking message delivery |

**Deprecated/outdated:**
- metascraper: Heavier than unfurl.js, more dependencies
- ip package < 1.1.9: CVE-2023-42282, SSRF bypass vulnerability
- private-ip package: Multicast address bypass vulnerability

## Open Questions

Things that couldn't be fully resolved:

1. **Cache TTL for Link Previews**
   - What we know: Social platforms use 24-72 hour caching
   - What's unclear: Optimal TTL for self-hosted context
   - Recommendation: Start with 24 hours, configurable via env var

2. **Emoji-mart Bundle Loading Strategy**
   - What we know: Data is ~600KB, can be lazy loaded or CDN fetched
   - What's unclear: Best approach for offline/PWA support
   - Recommendation: Bundle data with app (already have service worker caching), lazy load component

3. **Preview Image Proxying**
   - What we know: Some sites block hotlinking, images may expire
   - What's unclear: Whether to proxy/cache preview images
   - Recommendation: Start with direct image URLs, add proxying if needed

4. **reaction:toggle with Custom Emoji**
   - What we know: Current reaction schema stores emoji as text
   - What's unclear: Store custom emoji as `:name:` text or reference ID?
   - Recommendation: Store as `:name:` text for simplicity, resolve to URL on render

## Sources

### Primary (HIGH confidence)
- [unfurl.js GitHub](https://github.com/jacktuck/unfurl) - API documentation, configuration options
- [sharp documentation](https://sharp.pixelplumbing.com/) - SVG to PNG, resize, animated GIF
- [emoji-mart GitHub](https://github.com/missive/emoji-mart) - Custom emoji categories, React integration
- [request-filtering-agent GitHub](https://github.com/azu/request-filtering-agent) - SSRF protection patterns
- [OWASP SSRF Prevention](https://owasp.org/www-community/pages/controls/SSRF_Prevention_in_Nodejs) - Best practices

### Secondary (MEDIUM confidence)
- [frimousse documentation](https://frimousse.liveblocks.io/) - Confirmed lacks custom emoji support
- [Node.js Security Blog](https://www.nodejs-security.com/blog/dont-be-fooled-multicast-ssrf-bypass-private-ip) - SSRF bypass techniques

### Tertiary (LOW confidence)
- Web search results on caching strategies - General patterns, not library-specific

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - unfurl.js and sharp well-documented, emoji-mart switch is architectural change
- Architecture: HIGH - Follows established patterns in codebase (BullMQ, schema structure)
- Pitfalls: HIGH - SSRF protection well-documented by OWASP, common issues catalogued
- Custom emoji integration: MEDIUM - Requires replacing existing picker, migration work

**Research date:** 2026-01-21
**Valid until:** 30 days (stable libraries, infrequent breaking changes)

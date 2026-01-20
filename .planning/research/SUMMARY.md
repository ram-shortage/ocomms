# Project Research Summary: v0.4.0

**Project:** OComms - Self-Hosted Real-Time Team Chat Platform
**Domain:** Team collaboration (Slack-like) - File Uploads, Theming, Notes
**Researched:** 2026-01-20
**Confidence:** HIGH

## Executive Summary

OComms v0.4.0 adds three feature areas: file uploads (any type, 25MB max, local disk), dark mode theming (light/dark/system toggle), and markdown notes (one per channel, one personal per user). Research confirms well-established patterns exist for all three features, and critically, OComms already has proven implementations that can be extended rather than built from scratch.

The recommended approach leverages existing codebase patterns: extend the avatar upload route for general file attachments (native FormData + magic bytes validation), use the de facto standard `next-themes` library for theming (existing CSS variables already support dark mode), and implement notes with simple `react-markdown` rendering paired with textarea editing (avoiding WYSIWYG complexity). The key architectural insight is that "any member can edit" channel notes does NOT require real-time collaborative editing (CRDT/OT) - last-write-wins with optimistic locking and conflict detection is sufficient and explicitly in scope.

The primary risks are file upload security (memory exhaustion from large files, content-type bypass attacks, path traversal) and markdown XSS injection. Mitigation is straightforward: stream large files to disk instead of buffering in memory, validate magic bytes not MIME types, generate UUID filenames server-side, and use react-markdown which is XSS-safe by default. Dark mode has negligible risk when using `next-themes`.

## Key Findings

### Recommended Stack

v0.4.0 requires minimal new dependencies because OComms already has the foundational patterns in place. The avatar upload implementation demonstrates secure file handling with magic bytes validation and UUID filenames. The CSS variables in `globals.css` already define a full dark mode palette using OKLCH colors.

**Core technologies:**
- **Native FormData API**: File handling - Already working in avatar upload; no external library needed for 25MB files
- **next-themes (v0.4.6)**: Theme provider - De facto standard for Next.js; handles hydration, system preference, no FOUC
- **react-markdown (v10.1.0)**: Markdown rendering - React-native (no dangerouslySetInnerHTML), XSS-safe by default, React 19 compatible
- **remark-gfm (v4.x)**: GitHub Flavored Markdown - Tables, strikethrough, task lists for notes
- **rehype-highlight (v7.x)**: Syntax highlighting - Code block highlighting for technical notes

**New bundle impact:** ~40KB gzipped total (or ~15KB without syntax highlighting)

### Expected Features

**Must have (table stakes):**
- Drag-and-drop file upload with visual drop zone overlay
- Upload progress indicator with cancel option
- Image inline previews in messages
- 25MB file limit with server-side enforcement
- Magic byte validation (not just extensions)
- Multi-file upload support
- Three-way theme toggle (Light / Dark / System)
- System preference detection via `prefers-color-scheme`
- No flash of wrong theme (FOUC prevention)
- One markdown note per channel (shared, any member edits)
- One personal note per user per workspace (private scratchpad)
- Auto-save with debounce
- Basic formatting toolbar for non-markdown users

**Should have (competitive):**
- Video/audio inline playback (HTML5 native)
- Paste from clipboard (screenshots)
- Theme toggle animation
- Undo/redo in note editor
- @mention support in notes (reuse existing system)

**Defer (v2+):**
- PDF inline preview (requires PDF.js, +500KB bundle)
- Image lightbox/gallery
- File search integration
- Note version history
- Real-time collaborative editing (CRDT/OT) - explicitly out of scope
- Cloud storage integrations - violates self-hosted value prop

### Architecture Approach

All three features integrate cleanly with OComms' existing architecture. File uploads extend the avatar pattern with a new `/api/upload/file` route and `files`/`messageAttachments` tables. Theming wraps the app in a `ThemeProvider` component that manages the `.dark` CSS class. Notes add `channelNotes` and `personalNotes` tables with simple CRUD endpoints. None of these features require WebSocket changes beyond optionally emitting `note:updated` events when a channel note is saved.

**Major components:**
1. **File Upload API** (`/api/upload/file`) - Extends avatar pattern: validate magic bytes, generate UUID, write to `public/uploads/files/{yyyy-mm}/`, insert to DB, return metadata
2. **ThemeProvider** (wraps app) - Uses `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`
3. **NoteEditor component** - Simple textarea for editing + react-markdown for preview; no WYSIWYG complexity
4. **Conflict detection** - Optimistic locking via version number; reject stale updates with 409 response

### Critical Pitfalls

1. **Memory exhaustion from large files** - Current avatar upload uses `await file.arrayBuffer()` (OK for 2MB). For 25MB general uploads, this pattern would consume ~250MB RAM for 10 concurrent uploads. **Mitigation:** Stream to disk using `stream.pipeline()`, never buffer entire file in memory.

2. **Content-type/magic bytes bypass** - Attackers upload malicious files (PHP shells, SVG with XSS, polyglot files) that bypass validation. **Mitigation:** Validate magic bytes (already implemented), never trust client MIME type, re-encode images through sharp, serve with `X-Content-Type-Options: nosniff`.

3. **Flash of wrong theme (FOUC)** - Page briefly shows wrong theme before JavaScript hydrates. **Mitigation:** Use `next-themes` which injects a blocking script in `<head>` to apply theme class before body renders. Add `suppressHydrationWarning` to `<html>` element.

4. **Markdown XSS via sanitizer bypass** - DOMPurify has had CVEs (< 3.2.6). **Mitigation:** Use react-markdown which renders to React components (no `dangerouslySetInnerHTML`), inherently XSS-safe. Do NOT enable raw HTML in markdown.

5. **Notes editing conflicts (lost updates)** - Two users edit simultaneously, one's changes silently overwritten. **Mitigation:** Optimistic locking with version column; reject updates where `expectedVersion !== currentVersion`; return 409 Conflict and let client fetch latest.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Dark Mode/Theming
**Rationale:** Lowest dependency of all three features; no database changes, no backend API changes, purely additive. Quick win that immediately improves UX. Must be done first because file upload UI and notes UI need to render correctly in both themes.
**Delivers:** Three-way theme toggle (Light/Dark/System), FOUC-free page loads, preference persistence
**Addresses:** Table stakes theming features
**Avoids:** FOUC (Pitfall 6) by using next-themes; third-party conflicts (Pitfall 7) mitigated because shadcn/ui already has excellent dark mode support

**Tasks:**
1. Install next-themes
2. Create ThemeProvider component
3. Update root layout with suppressHydrationWarning
4. Add ThemeToggle to settings
5. Test all existing components in both modes

**Estimated effort:** 1 day

### Phase 2: File Uploads
**Rationale:** More complex than theming but simpler than notes. Database schema change, new API route extending proven pattern, UI changes to MessageComposer. Must come before notes if we want note attachments later.
**Delivers:** Full file attachment support in messages - drag-drop, progress, inline previews, 25MB limit
**Uses:** Native FormData API, existing magic bytes validation pattern, nanoid for filenames
**Implements:** Files and messageAttachments schema, `/api/upload/file` route, FilePreview components
**Avoids:** Memory exhaustion (Pitfall 2) by streaming to disk; path traversal (Pitfall 3) by UUID filenames; content-type bypass (Pitfall 1) by magic bytes validation

**Tasks:**
1. Create files and messageAttachments schema migration
2. Create /api/upload/file route (stream to disk)
3. Extend magic bytes validation for PDF, ZIP, common document types
4. Add drag-drop zone to MessageComposer
5. Add file picker button
6. Update message:send Socket handler to accept fileIds
7. Create FilePreview and ImagePreview components
8. Add upload progress indicator
9. Update Docker volume for uploads persistence

**Estimated effort:** 3-4 days

### Phase 3: Channel & Personal Notes
**Rationale:** Most complex feature with new UX patterns. Depends on understanding channel UI (from existing work) and theming (for notes UI). Database schema, new API routes, new components.
**Delivers:** Markdown notes per channel and personal scratchpad
**Uses:** react-markdown + remark-gfm + rehype-highlight for rendering; textarea for editing
**Implements:** channelNotes and personalNotes schema, CRUD endpoints, NoteEditor component
**Avoids:** XSS (Pitfall 4) by using react-markdown (no raw HTML); lost updates (Pitfall 10) by optimistic locking

**Tasks:**
1. Create channelNotes and personalNotes schema migration
2. Create /api/channels/{id}/notes endpoint (GET, PUT)
3. Create /api/user/notes endpoint for personal notes
4. Install react-markdown + remark-gfm + rehype-highlight
5. Create NoteEditor component (textarea + preview toggle)
6. Create NoteViewer component for rendering
7. Add notes tab to channel view
8. Add personal notes access point (user menu or sidebar)
9. Implement optimistic locking with version column
10. Optionally emit note:updated Socket event

**Estimated effort:** 4-5 days

### Phase Ordering Rationale

- **Theming first:** Affects all UI. Building file upload UI and notes UI without theming means testing twice later. Zero backend changes makes it the safest starting point.
- **File uploads second:** Extends proven avatar pattern. If notes need attachments later, file infrastructure must exist. More isolated than notes (only affects MessageComposer).
- **Notes last:** Most new surface area (new UI patterns, new API endpoints, new components). Benefits from theming being done (notes UI renders correctly) and potentially file uploads (future note attachments).

This order also matches complexity: theming is ~1 day, files ~3-4 days, notes ~4-5 days. Delivering value incrementally.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (File Uploads):** Stream-to-disk implementation in Next.js App Router needs validation. Test with actual 25MB files. Verify Docker volume persistence works correctly.
- **Phase 3 (Notes):** Conflict UI design needs UX decision - how to present "note was edited by X" to user.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Dark Mode):** Completely standard implementation. next-themes + existing CSS variables = done. Dozens of tutorials match this exact setup.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended packages verified for React 19/Next.js 15 compatibility. Extends existing patterns. |
| Features | HIGH | Table stakes verified against Slack, Discord, Teams documentation. Anti-features clearly excluded. |
| Architecture | HIGH | Matches existing OComms patterns. v0.4.0 section builds on proven codebase. |
| Pitfalls | HIGH | Cross-verified with OWASP, CVE databases, and multiple security resources. |

**Overall confidence:** HIGH

### Gaps to Address

- **File streaming implementation:** Current avatar code uses `arrayBuffer()`. Need to validate stream-to-disk approach in Next.js App Router works as expected. Test before finalizing implementation.
- **Conflict UI for notes:** Research shows conflict should be detected but doesn't prescribe exact UI. Decision needed: modal vs inline warning vs auto-merge preview.
- **Virus scanning (optional):** ClamAV integration documented but marked optional. Decision needed on whether to include in v0.4.0 or defer.
- **Storage quota tracking:** Schema design should include but enforcement deferred. Document disk requirements for self-hosters.

## Sources

### Primary (HIGH confidence)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) - File security patterns
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) - Theme implementation
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - Markdown rendering approach
- [Slack: Add Files to Slack](https://slack.com/help/articles/201330736-Add-files-to-Slack) - Feature expectations
- [Slack Canvas Features](https://slack.com/features/canvas) - Notes feature model
- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) - System theme detection
- [shadcn/ui Dark Mode](https://ui.shadcn.com/docs/dark-mode/next) - Theming pattern
- OComms codebase: `/src/app/api/upload/avatar/route.ts`, `/src/app/globals.css` - Existing patterns

### Secondary (MEDIUM confidence)
- [CVE-2025-47935: Multer DoS](https://www.miggo.io/vulnerability-database/cve/CVE-2025-47935) - Memory exhaustion pitfall
- [Josh Comeau: Perfect Dark Mode](https://www.joshwcomeau.com/react/dark-mode/) - FOUC prevention
- [DOMPurify CVE-2025-26791](https://security.snyk.io/vuln/SNYK-JS-DOMPURIFY-8722251) - XSS risk awareness
- [HackerOne Secure Markdown](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety) - Markdown security
- [TinyMCE OT vs CRDT](https://www.tiny.cloud/blog/real-time-collaboration-ot-vs-crdt/) - Notes collaboration context

### Tertiary (LOW confidence)
- Community blog posts on file streaming in Next.js App Router - Implementation details need validation

---
*Research completed: 2026-01-20*
*Ready for roadmap: yes*

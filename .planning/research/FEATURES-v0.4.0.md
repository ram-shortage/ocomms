# Feature Landscape: Files, Theming & Notes

**Domain:** Team chat application (Slack-like)
**Version:** v0.4.0
**Researched:** 2026-01-20
**Confidence:** HIGH (verified against Slack, Discord, Teams documentation; OWASP guidelines; MDN/CSS-Tricks)

---

## Executive Summary

v0.4.0 introduces three feature areas that enhance OComms beyond basic messaging: file attachments, dark mode theming, and channel/personal notes. Research indicates well-established patterns exist for all three areas, with clear table stakes and known pitfalls.

**File Attachments:** Drag-and-drop upload with progress indicators and inline image previews are table stakes. Security validation (magic bytes, not just extensions) is critical. Cloud storage integrations should be avoided to maintain the self-hosted value proposition.

**Dark Mode:** Three-way toggle (Light/Dark/System) with localStorage persistence is the expected pattern. CSS custom properties make implementation straightforward. The main pitfall is FOUC (flash of unstyled content) on page load, which requires an inline script in `<head>`.

**Channel/Personal Notes:** Slack Canvas provides the clearest reference. One markdown note per channel (collaborative) and one personal note per user (private) covers the use case. Real-time collaborative editing (CRDT/OT) is explicitly out of scope and should remain so--it's a massive complexity trap.

---

## 1. File Attachments

### Table Stakes (Must Have)

Features users expect from file attachments in team chat. Missing these = feature feels incomplete.

| Feature | Why Expected | Complexity | Confidence | Notes |
|---------|--------------|------------|------------|-------|
| **Drag-and-drop upload** | Universal pattern; Slack, Discord, Teams all support | Low | HIGH | Visual overlay when dragging files into window |
| **Click-to-browse fallback** | Accessibility requirement; some users prefer/need this | Low | HIGH | Plus icon or paperclip in composer |
| **Upload progress indicator** | Users need feedback during upload; eliminates anxiety | Medium | HIGH | Progress bar with percentage; cancelable |
| **Image inline previews** | Images should display in-chat, not just download links | Medium | HIGH | Discord/Slack show images inline up to size limit |
| **File size limit enforcement** | All platforms have limits; users expect clear feedback | Low | HIGH | 25MB specified in PROJECT.md; server-side enforcement |
| **Multi-file upload** | Users expect batch uploads | Low | HIGH | Slack allows 10 files per drop |
| **Download button/link** | Must retrieve uploaded files | Low | HIGH | Click to download; preserve original filename |
| **File type icons** | Visual distinction between PDFs, docs, images | Low | HIGH | Generic icons for common MIME types |
| **Filename and size display** | Show original name and human-readable size | Low | HIGH | "document.pdf - 2.3 MB" format |
| **Error states** | Clear feedback on upload failure | Low | HIGH | Size exceeded, invalid type, network error messages |
| **Security validation** | Prevent malicious uploads | High | HIGH | Validate magic bytes, not just extension |

**Sources:**
- [Slack: Add Files to Slack](https://slack.com/help/articles/201330736-Add-files-to-Slack) - 1GB limit, drag-drop up to 10 files, malware scanning
- [Discord: File Attachments FAQ](https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ) - 10MB free tier, inline previews for images
- [Uploadcare: File Uploader UX Best Practices](https://uploadcare.com/blog/file-uploader-ux-best-practices) - Progress indicators, error states
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) - Security validation

### Differentiators (Competitive Advantage)

Features that enhance the experience but aren't expected. Value-add for power users.

| Feature | Value Proposition | Complexity | Confidence | Notes |
|---------|-------------------|------------|------------|-------|
| **Video/audio inline playback** | Enhanced UX; no download needed | Medium | HIGH | HTML5 video/audio for MP4, WebM, MP3 |
| **Paste from clipboard** | Power user feature; very convenient | Medium | HIGH | Ctrl/Cmd+V to attach screenshots |
| **Image lightbox/gallery** | Better viewing for multiple images | Medium | MEDIUM | Click to expand; navigate between images |
| **PDF inline preview** | View documents without downloading | High | MEDIUM | Requires PDF.js; adds bundle size |
| **File search integration** | Find files across channels | Medium | MEDIUM | Extend existing PostgreSQL FTS |

### Anti-Features (Do NOT Build)

Features that seem valuable but are traps for this type of application.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Cloud storage integrations** | Breaks self-hosted value prop; adds external dependencies (Google Drive, Dropbox, OneDrive APIs) | Local file storage only; users can manually upload |
| **File editing in-app** | Massive scope creep; complex integrations | Download, edit locally, re-upload |
| **Automatic file compression** | Unexpected behavior; quality loss complaints | Let users compress before upload if needed |
| **File versioning/history** | Complexity trap; not expected in chat apps | Single file per upload; delete and re-upload for updates |
| **Folder organization** | Chat isn't a file manager; channels provide organization | Files exist within message context |
| **Real-time collaborative editing** | Explicitly out of scope in PROJECT.md; extreme complexity | Use dedicated tools (Google Docs, Notion) |
| **Per-workspace/channel quotas** | Admin complexity for v1 | Consider for v0.5.0+ if storage becomes issue |

### File Upload UX Patterns

**Drop Zone Behavior:**

When user drags files into the window:
1. Show translucent overlay with drop zone prompt
2. Change border/background color to indicate active area
3. Show file preview(s) once dropped
4. Display in message composer before send (allow cancel)

**Progress Indicator States:**
- **Waiting:** File queued, not yet uploading
- **In Progress:** Progress bar with percentage
- **Uploaded:** Success indicator
- **Error:** Red indicator with message (retry button)

**Multiple Files:**
- Display as grid/mosaic if multiple images
- Group into single message
- Individual progress for each file

**Sources:**
- [Filestack: Building Modern Drag-and-Drop Upload UI](https://blog.filestack.com/building-modern-drag-and-drop-upload-ui/)
- [PatternFly: Multiple File Upload Guidelines](https://www.patternfly.org/components/file-upload/multiple-file-upload/design-guidelines/)

### Security Requirements

Based on [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html):

| Requirement | Implementation | Priority |
|-------------|----------------|----------|
| **Magic byte validation** | Check actual file type, not just extension | Critical |
| **Server-side size limit** | Enforce 25MB max regardless of client | Critical |
| **Generated filenames** | Never use client-provided paths; UUID-based | Critical |
| **Store outside webroot** | Serve via auth-checked API route | Critical |
| **Content-Disposition header** | `attachment` for downloads; `inline` for previews | High |
| **X-Content-Type-Options** | `nosniff` header on served files | High |
| **Membership verification** | Check channel access before serving file | Critical |

---

## 2. Dark Mode

### Table Stakes (Must Have)

Features users expect from dark mode in 2025. 82% of users prefer dark mode option.

| Feature | Why Expected | Complexity | Confidence | Notes |
|---------|--------------|------------|------------|-------|
| **Dark/Light toggle** | Essential modern feature; most apps have it | Low | HIGH | UI control in settings or header |
| **System preference detection** | Users expect apps to respect OS setting | Low | HIGH | `prefers-color-scheme` media query |
| **Three-way toggle** | Light / Dark / System - gives full control | Low | HIGH | System = follow OS; manual override available |
| **Preference persistence** | Remember choice across sessions/devices | Low | HIGH | localStorage + user DB preference |
| **Smooth color transitions** | Jarring instant changes feel broken | Low | HIGH | CSS `transition: 0.3s` on background/color |
| **WCAG contrast (4.5:1)** | Accessibility requirement | Medium | HIGH | Test with contrast checker tools |
| **Dark gray backgrounds** | Pure black (#000) causes eye strain | Low | HIGH | Use #1a1a1a to #2d2d2d range |
| **Native element theming** | Scrollbars, inputs, selects should match | Low | HIGH | `color-scheme: light dark` CSS property |

**Sources:**
- [Smashing Magazine: Inclusive Dark Mode](https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/) - Accessibility, astigmatism considerations
- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) - Media query documentation
- [Tailwind CSS: Dark Mode](https://tailwindcss.com/docs/dark-mode) - Implementation patterns
- [CSS-Tricks: Dark Mode Guide](https://css-tricks.com/a-complete-guide-to-dark-mode-on-the-web/) - Comprehensive overview

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Confidence | Notes |
|---------|-------------------|------------|------------|-------|
| **No FOUC** | Professional feel; no jarring flash on load | Medium | HIGH | Inline script in `<head>` before render |
| **View Transitions API** | Premium feel; theme "grows" from toggle | High | MEDIUM | Modern browsers only; needs graceful fallback |
| **Toggle animation** | Polished interaction design | Low | MEDIUM | Animated sun/moon icon |
| **Sync across devices** | User preference follows them | Low | HIGH | Store in user DB, not just localStorage |

### Anti-Features (Do NOT Build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Forced dark only** | Alienates users with astigmatism/light preference | Always provide toggle |
| **Pure black (#000000)** | Causes text blur, haloing, eye strain | Use dark gray (#1a1a1a-#2d2d2d) |
| **No transitions** | Feels jarring and broken | 0.3-0.5s CSS transition |
| **Ignoring system pref** | Users set OS theme for a reason | Default to system, allow override |
| **Complex theme builder** | Scope creep; diminishing returns | Three-way toggle is sufficient |
| **Per-channel themes** | Confusing; unnecessary complexity | Global theme only |
| **Scheduled switching** | OS handles this already | Redundant feature |
| **High contrast mode** | Separate accessibility feature | Consider for v0.5.0+ |

### Implementation Pattern

**Recommended approach for Next.js:**

```
1. CSS Custom Properties
   - --bg-primary, --bg-secondary, --text-primary, etc.
   - Define light values as default, dark in [data-theme="dark"]

2. Theme Detection & Storage
   - Check localStorage first (user override)
   - Fall back to prefers-color-scheme (system)
   - Store preference in user DB for cross-device sync

3. FOUC Prevention
   - Inline <script> in _document.tsx or layout.tsx <head>
   - Sets data-theme attribute BEFORE React hydration
   - No className flicker

4. React Context
   - ThemeContext provides theme value and toggle function
   - Updates localStorage, DB, and data-theme attribute

5. Toggle UI
   - Settings page: radio buttons (Light/Dark/System)
   - Quick toggle in header: icon button cycling themes
```

**Sources:**
- [View Transitions API for Theme Toggle](https://akashhamirwasia.com/blog/full-page-theme-toggle-animation-with-view-transitions-api/)
- [Complete Dark Mode Design Guide 2025](https://ui-deploy.com/blog/complete-dark-mode-design-guide-ui-patterns-and-implementation-best-practices-2025)

---

## 3. Channel/Personal Notes

### Table Stakes (Must Have)

Based on Slack Canvas feature set and user expectations for notes in team chat.

| Feature | Why Expected | Complexity | Confidence | Notes |
|---------|--------------|------------|------------|-------|
| **Markdown editing** | Standard for technical/chat tools | Medium | HIGH | Bold, italic, code blocks, links, lists |
| **Auto-save** | Users expect not to lose work | Low | HIGH | Debounced save (1-2s after typing stops) |
| **One note per channel** | Consistent, predictable location | Low | HIGH | Slack Canvas model: one per channel |
| **Personal notes (private)** | Scratchpad for drafts, todos | Low | HIGH | Not visible to others |
| **Channel notes (shared)** | Team docs, pinned info | Medium | HIGH | Visible to channel members |
| **Any member can edit** | Collaborative by default | Low | HIGH | Slack Canvas allows all members |
| **Rich text preview** | See formatted output | Low | HIGH | Render Markdown to HTML |
| **Basic formatting toolbar** | Accessibility for non-Markdown users | Low | HIGH | Bold/italic/link buttons |

**Sources:**
- [Slack Canvas Features](https://slack.com/features/canvas) - Product overview
- [Slack: Use a Canvas](https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack) - Documentation
- [Slack: Channel Canvases Feature Change (2025)](https://slack.com/help/articles/21290478840979-Feature-change-notice--Channel-canvases) - Recent updates

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Confidence | Notes |
|---------|-------------------|------------|------------|-------|
| **Version history** | Undo mistakes; see what changed | Medium | MEDIUM | Store revision log |
| **@mention support** | Reference team members in notes | Low | HIGH | Reuse existing mention system |
| **Emoji support** | Consistency with chat | Low | HIGH | Reuse frimousse picker |
| **Undo/redo** | Standard editing feature | Medium | HIGH | Ctrl/Cmd+Z support |
| **Note tab in channel header** | Easy access; always visible location | Low | MEDIUM | Like Slack Canvas tab |
| **Presence indicators** | Know who's viewing the note | Medium | MEDIUM | Leverage existing presence system |
| **Code syntax highlighting** | Better for technical teams | Low | MEDIUM | highlight.js or similar |

### Anti-Features (Do NOT Build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time collaborative editing** | Explicitly out of scope; requires CRDT/OT (months of work) | Last-write-wins with conflict warning |
| **Multiple notes per channel** | Complexity; channels become file managers | One note per channel; use messages for transient info |
| **Nested folders** | Over-engineering; chat isn't Notion | Flat: one per channel, one personal |
| **Comments on notes** | Adds complexity | Use channel messages to discuss note content |
| **Note templates** | Enterprise feature creep | Start with blank canvas |
| **Cross-channel sharing** | Complicates permissions | Notes belong to one channel |
| **Offline editing** | PWA storage limits; sync complexity | Read-only offline; edit requires connection |
| **Full WYSIWYG** | Heavy; Markdown is sufficient for v1 | Markdown + toolbar + preview |
| **Embedded files in notes** | Storage complexity | Reference messages with files |
| **Note notifications** | Noisy; notes aren't urgent | Manual sharing via channel message |

### Collaboration Model

**For v0.4.0 (Simple Model):**

Since real-time collaboration is out of scope, use last-write-wins with conflict detection:

```
1. User opens note
   - Fetch current content + timestamp
   - Store local copy of "base" content

2. User edits note
   - Auto-save debounced (1-2 seconds)
   - On save: check if server timestamp > base timestamp
     - If no conflict: save, update base
     - If conflict: show warning "Note was edited by X. Merge or overwrite?"

3. Conflict resolution
   - Show diff (simplified: "Your version" vs "Their version")
   - Options: "Keep yours" | "Keep theirs" | "Cancel"
   - No complex merge UI for v1
```

**Future Enhancement (v0.5.0+):**
- Presence indicators (who's viewing)
- Live cursor positions (read-only awareness)
- Full collaborative editing would require CRDT implementation

**Sources:**
- [Design Gurus: Real-Time Collaborative Document Editor](https://www.designgurus.io/blog/design-real-time-editor) - Architecture overview
- [Google Workspace: Real-Time Editing](https://workspace.google.com/resources/real-time-editing/) - Feature expectations

### Data Model

```sql
-- Channel notes (one per channel)
CREATE TABLE channel_notes (
  id UUID PRIMARY KEY,
  channel_id UUID UNIQUE REFERENCES channels(id),
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1
);

-- Personal notes (one per user per workspace)
CREATE TABLE personal_notes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  workspace_id UUID REFERENCES workspaces(id),
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, workspace_id)
);
```

---

## Feature Dependencies

```
File Uploads
  - Uses existing message system (attachments array)
  - Local disk storage (per PROJECT.md)
  - No external dependencies

Dark Mode
  - CSS custom properties
  - localStorage for persistence
  - User DB preference for sync
  - No external dependencies

Notes
  - Depends on: channel membership (for edit permissions)
  - Optional: existing @mention system (for note mentions)
  - Optional: existing emoji picker (frimousse)
  - No external dependencies
```

---

## MVP Recommendation

### Must Ship (MVP Core)

**File Attachments:**
1. Drag-and-drop upload with visual drop zone
2. Click-to-browse fallback (accessibility)
3. Upload progress indicator (cancelable)
4. Image inline previews
5. 25MB limit with server-side enforcement
6. Download button with original filename
7. File type icons and metadata display
8. Magic byte validation (security)
9. Multi-file upload support

**Dark Mode:**
1. Three-way toggle (Light / Dark / System)
2. System preference detection (prefers-color-scheme)
3. localStorage persistence
4. Smooth CSS transitions (0.3s)
5. WCAG-compliant contrast ratios
6. Dark gray backgrounds (not pure black)
7. FOUC prevention (inline script)

**Notes:**
1. One Markdown note per channel (shared)
2. One personal note per user (private)
3. Auto-save with debounce
4. Basic Markdown rendering (bold, italic, code, links, lists)
5. Any channel member can edit channel notes
6. Formatting toolbar (bold/italic/link buttons)
7. Last-write-wins with conflict warning

### Should Ship (MVP Complete)

**File Attachments:**
8. Video/audio inline playback
9. Paste from clipboard

**Dark Mode:**
8. Sync preference to user DB (cross-device)
9. Toggle animation (icon transition)

**Notes:**
8. Undo/redo support
9. @mention support in notes

### Defer to v0.5.0+

| Feature | Reason to Defer |
|---------|-----------------|
| PDF inline preview | Requires PDF.js; adds 500KB+ to bundle |
| Image lightbox/gallery | Enhancement, not core functionality |
| File search integration | Requires FTS schema changes |
| Note version history | Adds DB complexity; not expected in v1 |
| Note presence indicators | Nice-to-have; leverage existing presence later |
| View Transitions animation | Progressive enhancement for polish |
| Code syntax highlighting | Enhancement for technical teams |
| Storage quotas | Admin feature for later if needed |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| File Upload UX | HIGH | Well-documented patterns from Slack, Discord, OWASP |
| File Security | HIGH | OWASP provides authoritative guidance |
| Dark Mode | HIGH | CSS standards well-established; many implementation guides |
| Notes Features | HIGH | Slack Canvas provides clear reference model |
| Notes Collaboration | MEDIUM | Simple model clear; complex model explicitly out of scope |
| Anti-Features | HIGH | PROJECT.md already excludes collaborative editing |

---

## Sources Summary

### High Confidence (Official Documentation)
- [Slack: Add Files to Slack](https://slack.com/help/articles/201330736-Add-files-to-Slack)
- [Discord: File Attachments FAQ](https://support.discord.com/hc/en-us/articles/25444343291031-File-Attachments-FAQ)
- [Slack Canvas Features](https://slack.com/features/canvas)
- [Slack: Channel Canvases Feature Change 2025](https://slack.com/help/articles/21290478840979-Feature-change-notice--Channel-canvases)
- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Tailwind CSS: Dark Mode](https://tailwindcss.com/docs/dark-mode)

### Medium Confidence (Industry Guides)
- [Smashing Magazine: Inclusive Dark Mode 2025](https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/)
- [Uploadcare: File Uploader UX Best Practices](https://uploadcare.com/blog/file-uploader-ux-best-practices/)
- [Complete Dark Mode Design Guide 2025](https://ui-deploy.com/blog/complete-dark-mode-design-guide-ui-patterns-and-implementation-best-practices-2025)
- [CSS-Tricks: Dark Mode Guide](https://css-tricks.com/a-complete-guide-to-dark-mode-on-the-web/)
- [Filestack: Building Modern Drag-and-Drop Upload UI](https://blog.filestack.com/building-modern-drag-and-drop-upload-ui/)
- [OPSWAT: File Upload Protection Best Practices](https://www.opswat.com/blog/file-upload-protection-best-practices)
- [Design Gurus: Real-Time Collaborative Editor](https://www.designgurus.io/blog/design-real-time-editor)
- [View Transitions API for Theme Toggle](https://akashhamirwasia.com/blog/full-page-theme-toggle-animation-with-view-transitions-api/)

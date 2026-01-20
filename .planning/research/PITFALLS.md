# Domain Pitfalls

**Project:** OComms - Self-Hosted Team Chat Platform
**Milestone:** v0.4.0 - File Uploads, Theming, and Notes
**Researched:** 2026-01-20
**Confidence:** MEDIUM-HIGH (cross-verified with multiple authoritative sources)

---

## Critical Pitfalls

Mistakes that cause security breaches, data loss, or require significant rewrites.

---

### Pitfall 1: File Upload Content-Type/Magic Bytes Bypass

**What goes wrong:** Attackers upload malicious files (PHP shells, SVG with JavaScript, polyglot files) that bypass validation by spoofing MIME types or embedding valid magic bytes with malicious payloads.

**Why it happens:** Relying solely on client-provided Content-Type header or only checking magic bytes without validating entire file structure. Attackers create "polyglot" files that are simultaneously valid images AND executable code.

**Consequences:**
- Remote code execution if files are served with wrong Content-Type
- Stored XSS via SVG files containing JavaScript
- Server compromise via uploaded web shells
- Complete security posture destruction

**Warning signs:**
- Validation only checks Content-Type header from client
- Magic bytes checked but rest of file not validated
- SVG files allowed without sanitization
- Uploaded files served from same origin as application

**Prevention:**
1. **Never trust client-provided MIME type** - OComms already does this correctly in avatar upload
2. **Validate magic bytes AND file structure** - Use format-specific parsers (sharp for images)
3. **Re-encode uploaded images** - Process through image library to strip embedded code
4. **Serve from separate domain/CDN** - Isolate uploaded content from application origin
5. **Set X-Content-Type-Options: nosniff** - Prevent MIME sniffing attacks
6. **Allowlist file types** - Only accept specific extensions, reject everything else

**Phase to address:** Phase 1 (File Upload Infrastructure) - Core security decision

**Confidence:** HIGH - [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [PortSwigger File Upload Vulnerabilities](https://portswigger.net/web-security/file-upload)

---

### Pitfall 2: Memory Exhaustion from Large File Uploads

**What goes wrong:** Server crashes or becomes unresponsive when users upload large files because entire file is buffered in memory before processing.

**Why it happens:** Using libraries like Multer with default memory storage. Each concurrent upload consumes server RAM until complete. With 10 users uploading 100MB files simultaneously = 1GB RAM consumed.

**Consequences:**
- Server out-of-memory crashes
- Denial of service (intentional or accidental)
- Container restarts in Docker/K8s environments
- All users affected by single bad upload

**Warning signs:**
- Using `multer.memoryStorage()` or similar
- `arrayBuffer()` called on entire file before validation (current avatar code does this)
- No streaming to disk or object storage
- Testing only with small files

**Prevention:**
1. **Stream directly to disk/storage** - Never buffer entire file in memory
2. **Set strict size limits early** - Reject oversized files before reading
3. **Use chunked uploads for large files** - tus protocol or similar
4. **Implement per-user rate limiting** - Limit concurrent uploads per user
5. **Use `stream.pipeline()`** - Properly handles errors and prevents memory leaks
6. **Monitor memory usage** - Alert on unusual memory consumption

**Current OComms state:** Avatar upload reads entire file with `await file.arrayBuffer()` - this works for 2MB limit but pattern should not extend to general file uploads.

**Phase to address:** Phase 1 (File Upload Infrastructure) - Architecture decision

**Confidence:** HIGH - [CVE-2025-47935: Multer DoS](https://www.miggo.io/vulnerability-database/cve/CVE-2025-47935), [Multer Memory Trap](https://medium.com/@codewithmunyao/the-multer-memory-trap-why-your-file-upload-strategy-is-killing-your-server-89f9e8797e58)

---

### Pitfall 3: Path Traversal in File Storage

**What goes wrong:** Attacker-controlled filenames allow writing files outside intended directory, potentially overwriting application code or system files.

**Why it happens:** Using user-provided filename directly in path construction. Characters like `../` or Windows device names (`CON`, `AUX`) bypass sanitization.

**Consequences:**
- Arbitrary file write = Remote code execution
- Application code overwritten
- Configuration files modified
- System compromise

**Warning signs:**
- User-provided filename used in path
- Only checking for `../` without URL decoding first
- No filename sanitization
- Windows device names not blocked

**Prevention:**
1. **Generate random filenames server-side** - OComms correctly uses UUID for avatars
2. **Never use user-provided filename in path** - Store original name in database if needed
3. **URL decode before validation** - Attackers use `%2e%2e%2f` for `../`
4. **Validate final path is within intended directory** - Use `path.resolve()` and compare
5. **Block Windows reserved names** - CON, PRN, AUX, NUL, COM1-9, LPT1-9

**Current OComms state:** Avatar upload generates UUID filenames - this pattern must continue for all file types.

**Phase to address:** Phase 1 (File Upload Infrastructure) - Already handled, maintain pattern

**Confidence:** HIGH - [CVE-2025-23084](https://security.snyk.io/vuln/SNYK-UPSTREAM-NODE-8651420), [Node.js Path Traversal Guide](https://www.stackhawk.com/blog/node-js-path-traversal-guide-examples-and-prevention/)

---

### Pitfall 4: Markdown/Notes XSS via Sanitizer Bypass

**What goes wrong:** Malicious markdown/HTML bypasses DOMPurify sanitization through mutation XSS (mXSS), namespace confusion, or version-specific bugs, leading to stored XSS.

**Why it happens:** HTML sanitization is fundamentally difficult. Browser DOM parsing differs from sanitizer parsing, allowing crafted input to appear safe during sanitization but become dangerous after browser renders it.

**Consequences:**
- Stored XSS affecting all users who view the note
- Session hijacking
- Credential theft
- Malware distribution through trusted platform

**Warning signs:**
- Using outdated DOMPurify version (< 3.2.6 has known bypasses)
- Sanitizing server-side with jsdom < 20.0.0
- Not sanitizing at render time (only at storage time)
- Allowing HTML in markdown without sanitization
- Using happy-dom for server-side sanitization

**Prevention:**
1. **Keep DOMPurify updated** - Currently 3.3.1, check for updates regularly
2. **Sanitize at render time** - Not just at storage, in case of future bypasses
3. **Use strict DOMPurify config** - Disable `ALLOW_DATA_ATTR`, limit allowed tags
4. **Avoid server-side HTML parsing** - Use jsdom >= 20.0.0 if needed, never happy-dom
5. **Consider markdown-only** - Don't allow raw HTML in markdown at all
6. **CSP as defense-in-depth** - Even if XSS gets through, CSP limits damage

**Phase to address:** Phase 3 (Notes Feature) - Critical security decision

**Confidence:** HIGH - [DOMPurify CVE-2025-26791](https://security.snyk.io/vuln/SNYK-JS-DOMPURIFY-8722251), [HackerOne Secure Markdown Guide](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety)

---

### Pitfall 5: ImageMagick/Sharp Processing Vulnerabilities

**What goes wrong:** Maliciously crafted images trigger memory corruption, integer overflow, or code execution in image processing libraries.

**Why it happens:** Image processing is extremely complex. Format-specific parsers have edge cases that can be exploited. ImageMagick has had 16 CVEs in 2025 alone.

**Consequences:**
- Remote code execution via uploaded image
- Server crash (DoS)
- Memory corruption
- Information disclosure

**Warning signs:**
- Using outdated image processing library
- Processing untrusted images without resource limits
- Allowing exotic image formats (MVG, MNG, SVG)
- No timeout on image processing operations

**Prevention:**
1. **Keep libraries updated** - ImageMagick 7.1.2-2+, sharp latest
2. **Limit allowed formats** - Only JPEG, PNG, WebP, GIF for user uploads
3. **Set resource limits** - Memory, processing time, image dimensions
4. **Process in sandboxed environment** - Container with limited privileges
5. **Consider dedicated image processing service** - Isolate from main application
6. **Disable dangerous coders** - MVG, SVG, MSL in ImageMagick policy.xml

**Phase to address:** Phase 1 (File Upload Infrastructure) - Choose library carefully

**Confidence:** HIGH - [ImageMagick CVE-2025-57803](https://gbhackers.com/critical-imagemagick-vulnerability/), [ImageMagick 2025 Vulnerabilities](https://stack.watch/product/imagemagick/imagemagick/)

---

## Moderate Pitfalls

Mistakes that cause significant UX issues, technical debt, or security weaknesses.

---

### Pitfall 6: Flash of Wrong Theme (FOUC)

**What goes wrong:** Page briefly displays in light mode before switching to dark mode (or vice versa), causing jarring visual flash on every page load.

**Why it happens:** Theme preference stored in localStorage/cookie, but JavaScript must execute to read it and apply. Server-rendered HTML doesn't know user's preference, so defaults to one theme.

**Consequences:**
- Jarring user experience on every navigation
- Users perceive app as "buggy" or "unpolished"
- Accessibility issue for users sensitive to bright flashes
- Professional appearance undermined

**Warning signs:**
- Theme preference read in `useEffect` or similar client-side hook
- No theme applied to initial HTML from server
- `className` applied after hydration
- Testing only in dev mode where caching masks the issue

**Prevention:**
1. **Inline blocking script in `<head>`** - Apply theme class before body renders
2. **Use cookies for SSR** - Server can read cookie and render correct theme
3. **CSS variables for colors** - Class change updates all colors instantly
4. **`next-themes` library** - Handles these edge cases correctly
5. **Test with hard refresh** - Ctrl+Shift+R to see real user experience

**Phase to address:** Phase 2 (Dark Mode/Theming) - Architecture decision early

**Confidence:** HIGH - [Josh Comeau: Perfect Dark Mode](https://www.joshwcomeau.com/react/dark-mode/), [Fixing Dark Mode Flickering](https://notanumber.in/blog/fixing-react-dark-mode-flickering)

---

### Pitfall 7: Third-Party Components Don't Respect Theme

**What goes wrong:** App is in dark mode, but embedded components (date pickers, modals, dropdowns from libraries) stay in light mode, creating visual inconsistency.

**Why it happens:** Third-party components use their own theming system or hardcoded colors. They don't automatically inherit your CSS variables or respond to your theme class.

**Consequences:**
- Inconsistent visual appearance
- Some UI elements painfully bright in dark mode
- User confusion about whether dark mode is "working"
- Workarounds lead to fragile CSS overrides

**Warning signs:**
- Using UI library without checking theming support
- Components with hardcoded colors (#ffffff, #000000)
- No theme prop or CSS variable support in library
- Testing dark mode only on custom components

**Prevention:**
1. **Audit dependencies for theme support** - Radix/shadcn (used by OComms) supports theming well
2. **Use CSS variables consistently** - Libraries should consume your variables
3. **Wrap non-themeable components** - Container with background override
4. **Choose themeable alternatives** - Replace libraries that don't support theming
5. **Test entire app in both modes** - Every screen, every component

**Current OComms state:** Using shadcn/ui which has excellent dark mode support via CSS variables.

**Phase to address:** Phase 2 (Dark Mode/Theming) - Audit before implementation

**Confidence:** MEDIUM - [Zendesk Dark Mode Docs](https://developer.zendesk.com/documentation/apps/app-developer-guide/dark-mode/), [CSS Tricks Dark Mode](https://css-tricks.com/easy-dark-mode-and-multiple-color-themes-in-react/)

---

### Pitfall 8: S3/Presigned URL Security Misconfiguration

**What goes wrong:** Presigned URLs for file downloads/uploads are shared, cached, or have overly long expiration, allowing unauthorized access.

**Why it happens:** Convenience over security - long expiration times "just work." Not understanding that presigned URLs are bearer tokens that grant access to anyone who has them.

**Consequences:**
- Confidential files accessible via shared URLs
- Files remain accessible long after user's access revoked
- URLs cached in browser history, proxy logs, referrer headers
- Compliance violations (GDPR, HIPAA)

**Warning signs:**
- Presigned URLs with multi-day expiration
- URLs embedded in HTML (cached, logged)
- No per-request URL generation
- Upload URLs without content verification

**Prevention:**
1. **Short expiration times** - 5-15 minutes for downloads, <1 hour for uploads
2. **Generate on demand** - Never embed in static HTML, fetch from API
3. **Use CloudFront signed URLs for caching** - Separate from direct S3 access
4. **Verify upload content** - Use Content-MD5 header requirement
5. **Log URL generation** - Audit trail of who accessed what
6. **Consider streaming through app** - For highly sensitive files

**Phase to address:** Phase 1 (File Upload Infrastructure) - If using S3/R2

**Confidence:** HIGH - [AWS Presigned URL Security](https://aws.amazon.com/blogs/compute/securing-amazon-s3-presigned-urls-for-serverless-applications/), [Presigned URL Pitfalls](https://insecurity.blog/2021/03/06/securing-amazon-s3-presigned-urls/)

---

### Pitfall 9: CSP Conflicts with File Uploads/Previews

**What goes wrong:** Content Security Policy blocks legitimate file previews, blob URLs for downloads, or inline styles needed for image display.

**Why it happens:** Strict CSP (which OComms should have) blocks blob:, data:, and inline styles by default. File upload features often need these for previews and downloads.

**Consequences:**
- File previews broken
- Downloads fail silently
- PDF viewers don't work
- Console errors but no user-visible feedback

**Warning signs:**
- CSP errors in console during file operations
- "blob: (blocked:csp)" errors
- File preview shows broken image
- PDF.js or similar viewers fail

**Prevention:**
1. **Plan CSP directives for file features** - Add `blob:` to img-src, object-src as needed
2. **Use nonces for inline styles** - If image dimensions set inline
3. **Serve files from allowed origin** - Configure connect-src appropriately
4. **Test file features with strict CSP** - Don't disable CSP during development
5. **Document CSP requirements** - For self-hosters who may customize

**Phase to address:** Phase 1 (File Upload Infrastructure) - CSP planning

**Confidence:** HIGH - [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy), [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

---

### Pitfall 10: Notes Editing Conflicts (Lost Updates)

**What goes wrong:** Two users edit the same note simultaneously, and one user's changes silently overwrite the other's.

**Why it happens:** Simple "last write wins" approach without conflict detection. No locking, operational transformation, or CRDT for concurrent edits.

**Consequences:**
- User work lost without warning
- Trust erosion - users afraid to edit shared notes
- Frustration and repeated work
- Support tickets about "disappearing content"

**Warning signs:**
- No version number or ETag on notes
- Simple PUT/POST overwrite
- No "someone else is editing" indicator
- Testing only with single user

**Prevention:**
1. **Optimistic locking with version numbers** - Reject stale updates
2. **Show "editing" indicator** - Real-time presence for notes
3. **Last-editor-wins with conflict detection** - At least warn user
4. **Consider CRDT for real-time collab** - Yjs, Automerge if needed
5. **Auto-save with debounce** - Reduce window for conflicts

**MVP recommendation:** Start with optimistic locking and presence indicators. Full CRDT is complex - defer unless real-time collaboration is required.

**Phase to address:** Phase 3 (Notes Feature) - Data model decision

**Confidence:** MEDIUM - [TinyMCE OT vs CRDT](https://www.tiny.cloud/blog/real-time-collaboration-ot-vs-crdt/), [Collaborative Editing Guide](https://dev.to/puritanic/building-collaborative-interfaces-operational-transforms-vs-crdts-2obo)

---

## Minor Pitfalls

Mistakes that cause annoyance, minor security weaknesses, or technical debt.

---

### Pitfall 11: Missing Virus/Malware Scanning

**What goes wrong:** User uploads malware-infected file, downloads it later (or another user downloads it), and their device is compromised.

**Why it happens:** Virus scanning seems like "enterprise overkill" for a chat app. ClamAV integration adds complexity. "Users trust each other" assumption.

**Consequences:**
- Malware spread through trusted platform
- Organizational devices compromised
- Legal/compliance liability
- Reputation damage

**Warning signs:**
- No malware scanning in upload pipeline
- "We'll add it later" attitude
- Assumption that file type validation is sufficient
- No plan for self-hosted ClamAV deployment

**Prevention:**
1. **Integrate ClamAV via clamscan npm package** - Scan before storing
2. **Run ClamAV as sidecar container** - Easy Docker deployment
3. **Quarantine suspicious files** - Don't delete, allow admin review
4. **Update virus definitions** - freshclam on schedule
5. **Document for self-hosters** - ClamAV setup instructions

**Phase to address:** Phase 1 (File Upload Infrastructure) - Optional but recommended

**Confidence:** MEDIUM - [ClamAV + Node.js Guide](https://transloadit.com/devtips/implementing-server-side-malware-scanning-with-clamav-in-node-js/), [NestJS ClamAV Integration](https://devkamal.medium.com/securing-file-uploads-in-nestjs-a-complete-guide-to-implementing-clamav-for-virus-scanning-and-a152a6f021d6)

---

### Pitfall 12: File Storage Quota Not Enforced

**What goes wrong:** Single user or workspace consumes all available storage by uploading many/large files, affecting all other users.

**Why it happens:** No per-workspace or per-user storage limits. Self-hosted deployments have finite disk space. "Unlimited storage" assumption from cloud services.

**Consequences:**
- Disk full, entire application fails
- Noisy neighbor problem in multi-tenant
- Self-hosters surprised by storage requirements
- No way to manage storage retroactively

**Warning signs:**
- No storage tracking per workspace/user
- No upload rejection when quota exceeded
- Disk usage not monitored
- Storage requirements not documented

**Prevention:**
1. **Track storage usage per workspace** - Sum of all file sizes
2. **Configurable quota limits** - Admin can set per workspace
3. **Reject uploads over quota** - Clear error message
4. **Dashboard showing usage** - Users can see their consumption
5. **Document storage requirements** - For self-hosted planning

**Phase to address:** Phase 1 (File Upload Infrastructure) - Schema design

**Confidence:** HIGH - Common sense for self-hosted applications

---

### Pitfall 13: Theme Transition Jank

**What goes wrong:** Toggling between light/dark mode causes visible color "jumping" as different elements transition at different speeds.

**Why it happens:** CSS transitions applied inconsistently. Some colors transition, others snap. Third-party components don't transition. Too many elements recalculating styles.

**Consequences:**
- Unpolished feel
- Motion sickness for some users
- Perceived as buggy
- Minor but noticeable quality issue

**Warning signs:**
- Different transition durations on different elements
- Some colors transition, others don't
- Repaint/reflow visible during toggle
- Testing only light-to-dark, not dark-to-light

**Prevention:**
1. **Consistent transition on color properties** - Or no transition at all
2. **Avoid transitioning layout properties** - Only colors, backgrounds
3. **Consider instant switch** - Some apps (Slack) don't transition
4. **Disable transitions on initial load** - Only on user toggle
5. **Test both directions** - Light-to-dark AND dark-to-light

**Phase to address:** Phase 2 (Dark Mode/Theming) - Polish phase

**Confidence:** MEDIUM - [CSS Variables Dark Mode](https://www.magicpatterns.com/blog/implementing-dark-mode)

---

### Pitfall 14: File Preview Not Respecting Permissions

**What goes wrong:** File preview URLs are guessable or don't check if requesting user has access, allowing unauthorized file viewing.

**Why it happens:** Preview endpoint only checks if file exists, not if user has permission. Or preview URL is same as download URL with no auth.

**Consequences:**
- Confidential files leaked via preview
- IDOR vulnerability
- Compliance violations
- Trust violation

**Warning signs:**
- Preview URL is `/uploads/{fileId}.jpg` with no auth
- Sequential/guessable file IDs
- No permission check on preview endpoint
- Different permission model for preview vs download

**Prevention:**
1. **Same permission check for preview and download** - User must have channel/conversation access
2. **Non-guessable file IDs** - UUIDs, not sequential integers
3. **Consider signed preview URLs** - Time-limited, user-specific
4. **Log preview access** - Audit trail

**Phase to address:** Phase 1 (File Upload Infrastructure) - Authorization design

**Confidence:** HIGH - Standard security practice

---

### Pitfall 15: Notes Search Not Integrated

**What goes wrong:** Users can search messages but not notes, or notes appear in search results without proper context/permissions.

**Why it happens:** Notes added as separate feature without considering search integration. Different content model than messages.

**Consequences:**
- Users can't find information in notes
- Inconsistent search experience
- Notes become "second-class" content
- Users avoid using notes

**Warning signs:**
- Search queries only against messages table
- Notes not indexed for full-text search
- No plan for notes in search from start
- Permission model not considered for search

**Prevention:**
1. **Design notes schema with search in mind** - tsvector column
2. **Same permission model as messages** - Notes belong to channels/DMs
3. **Unified search results** - Messages and notes together
4. **Clear result type indicator** - User knows if result is note or message

**Phase to address:** Phase 3 (Notes Feature) - Schema design

**Confidence:** MEDIUM - User experience consideration

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| File Upload Infrastructure | Memory exhaustion (Pitfall 2) | Stream to disk, never buffer |
| File Upload Infrastructure | Path traversal (Pitfall 3) | UUID filenames only |
| File Upload Infrastructure | Content-type bypass (Pitfall 1) | Validate magic bytes + re-encode |
| File Upload Infrastructure | CSP conflicts (Pitfall 9) | Plan blob:/img-src directives |
| File Serving | Presigned URL leaks (Pitfall 8) | Short expiration, generate per-request |
| File Serving | Permission bypass (Pitfall 14) | Same auth for preview and download |
| Dark Mode | FOUC (Pitfall 6) | Blocking script in head, cookies for SSR |
| Dark Mode | Third-party conflicts (Pitfall 7) | Audit components before implementing |
| Dark Mode | Transition jank (Pitfall 13) | Consistent or no transitions |
| Notes | XSS via markdown (Pitfall 4) | DOMPurify 3.3.1+, sanitize at render |
| Notes | Editing conflicts (Pitfall 10) | Optimistic locking, presence |
| Notes | Search integration (Pitfall 15) | Design with full-text search from start |

---

## Security-Specific Warnings for OComms

Given OComms' existing security posture (CSP headers, input validation, rate limiting, audit logging), these pitfalls require special attention:

### Must Maintain
1. **CSP integrity** - File features must work within CSP, not weaken it
2. **Audit logging** - File uploads/downloads should be logged
3. **Rate limiting** - File operations need rate limits (upload spam)
4. **Input validation** - Filename, size, type validation on all uploads

### New Security Additions for v0.4.0
1. **File-specific rate limiting** - Separate from message rate limiting
2. **Storage audit events** - Who uploaded/downloaded what, when
3. **Malware scanning consideration** - ClamAV integration
4. **Content-Type headers** - Always set explicitly on served files

---

## Sources Summary

### File Upload Security
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [PortSwigger File Upload Vulnerabilities](https://portswigger.net/web-security/file-upload)
- [Intigriti File Upload Guide](https://www.intigriti.com/researchers/blog/hacking-tools/insecure-file-uploads-a-complete-guide-to-finding-advanced-file-upload-vulnerabilities)
- [Sourcery Content-Type Bypass](https://www.sourcery.ai/vulnerabilities/file-upload-content-type-bypass)

### Memory and DoS
- [CVE-2025-47935: Multer DoS](https://www.miggo.io/vulnerability-database/cve/CVE-2025-47935)
- [Multer Memory Trap](https://medium.com/@codewithmunyao/the-multer-memory-trap-why-your-file-upload-strategy-is-killing-your-server-89f9e8797e58)
- [Handling Large File Uploads](https://www.ionicframeworks.com/2025/08/handle-large-file-uploads-in-nodejs.html)

### Path Traversal
- [CVE-2025-23084: Node.js Path Traversal](https://security.snyk.io/vuln/SNYK-UPSTREAM-NODE-8651420)
- [CVE-2025-27210: Windows Device Names](https://zeropath.com/blog/cve-2025-27210-nodejs-path-traversal-windows)
- [Node.js Path Traversal Guide](https://www.stackhawk.com/blog/node-js-path-traversal-guide-examples-and-prevention/)

### XSS and Sanitization
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify)
- [CVE-2025-26791: DOMPurify XSS](https://security.snyk.io/vuln/SNYK-JS-DOMPURIFY-8722251)
- [HackerOne Secure Markdown](https://www.hackerone.com/blog/secure-markdown-rendering-react-balancing-flexibility-and-safety)
- [mXSS: The Vulnerability Hiding in Your Code](https://www.sonarsource.com/blog/mxss-the-vulnerability-hiding-in-your-code/)

### Image Processing
- [ImageMagick CVE-2025-57803](https://gbhackers.com/critical-imagemagick-vulnerability/)
- [ImageMagick 2025 Vulnerabilities](https://stack.watch/product/imagemagick/imagemagick/)
- [ImageMagick CVE-2025-55154](https://zeropath.com/blog/imagemagick-cve-2025-55154)

### Dark Mode
- [Josh Comeau: Perfect Dark Mode](https://www.joshwcomeau.com/react/dark-mode/)
- [Fixing Dark Mode Flickering](https://notanumber.in/blog/fixing-react-dark-mode-flickering)
- [FOUC in Next.js App Router](https://dev.to/amritapadhy/understanding-fixing-fouc-in-nextjs-app-router-2025-guide-ojk)

### Presigned URLs and CSP
- [AWS Presigned URL Security](https://aws.amazon.com/blogs/compute/securing-amazon-s3-presigned-urls-for-serverless-applications/)
- [Presigned URL Pitfalls](https://insecurity.blog/2021/03/06/securing-amazon-s3-presigned-urls/)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

### Collaborative Editing
- [TinyMCE OT vs CRDT](https://www.tiny.cloud/blog/real-time-collaboration-ot-vs-crdt/)
- [Building Collaborative Interfaces](https://dev.to/puritanic/building-collaborative-interfaces-operational-transforms-vs-crdts-2obo)

### Antivirus Integration
- [ClamAV + Node.js](https://transloadit.com/devtips/implementing-server-side-malware-scanning-with-clamav-in-node-js/)
- [clamscan npm](https://www.npmjs.com/package/clamscan)

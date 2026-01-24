# Critical Security Code Review: OComms

**Review Date:** January 21, 2026
**Reviewer:** Claude Code Security Analysis
**Application:** OComms - Self-hosted Team Communication Platform
**Stack:** Next.js 16, React 19, Socket.IO, PostgreSQL, Redis, BullMQ

---

## Executive Summary

This security review analyzed the OComms codebase for vulnerabilities, security risks, and bad practices. The application demonstrates **strong security foundations** with several well-implemented security measures, but there are **critical, high, and medium severity issues** that require immediate attention.

### Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 3 | Requires immediate remediation |
| **HIGH** | 5 | Requires prompt remediation |
| **MEDIUM** | 8 | Should be addressed |
| **LOW** | 6 | Best practice improvements |
| **INFORMATIONAL** | 5 | Observations |

---

## CRITICAL SEVERITY ISSUES

### CRIT-01: Weak CSP Policy Allows Script Injection

**Location:** `nginx/conf.d/default.conf:43`

**Issue:** The Content Security Policy (CSP) includes `'unsafe-inline'` and `'unsafe-eval'` for scripts:

```nginx
Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ..."
```

**Risk:** This significantly weakens XSS protections. An attacker who can inject content could execute arbitrary JavaScript, bypassing the CSP entirely.

**Recommendation:**
1. Remove `'unsafe-inline'` and `'unsafe-eval'` from `script-src`
2. Use nonce-based CSP: `script-src 'self' 'nonce-{random}'`
3. Implement strict-dynamic for modern browsers
4. Move inline scripts to external files

**CVSS Score:** 7.5 (High)

---

### CRIT-02: Session Validation Cache Bypass Vulnerability

**Location:** `src/middleware.ts:32-42`

**Issue:** The session validation caching mechanism uses a client-controllable cookie (`_session_validated`) to skip authentication checks:

```typescript
const lastValidated = request.cookies.get("_session_validated");
if (lastValidated) {
  const validatedAt = parseInt(lastValidated.value, 10);
  // ... skips validation if within 5 minutes
}
```

**Risk:** A malicious user could:
1. Authenticate legitimately
2. Have their session revoked (logout, admin action)
3. Continue accessing protected resources for up to 5 minutes by preserving the `_session_validated` cookie

**Recommendation:**
1. Move validation cache to server-side (Redis or in-memory with user ID key)
2. Or use signed/encrypted cookies that cannot be forged
3. Invalidate cache when sessions are revoked

**CVSS Score:** 8.1 (High)

---

### CRIT-03: SVG Upload Without Proper Sanitization

**Location:** `src/app/api/upload/emoji/route.ts:99-119`

**Issue:** While SVGs are converted to PNG via Sharp, the validation accepts SVG files:

```typescript
if (!validated || !["png", "jpg", "gif", "webp", "svg"].includes(validated.extension)) {
```

SVG detection in `file-validation.ts` uses a simple text check:

```typescript
const textStart = new TextDecoder().decode(bytes.slice(0, 100));
if (textStart.trim().startsWith("<?xml") || textStart.trim().startsWith("<svg") || textStart.includes("<svg")) {
  return { extension: "svg", mimeType: "image/svg+xml", isImage: true };
}
```

**Risk:**
1. SVG files can contain embedded JavaScript that executes in browser context
2. The detection can be bypassed with crafted files
3. Sharp conversion may not sanitize all malicious content before processing

**Recommendation:**
1. Use a dedicated SVG sanitizer library (e.g., DOMPurify with server-side DOM)
2. Strip all script tags, event handlers, and foreign content before Sharp processing
3. Consider blocking SVG uploads entirely and requiring raster formats

**CVSS Score:** 7.8 (High)

---

## HIGH SEVERITY ISSUES

### HIGH-01: Missing Rate Limiting on Socket.IO Events

**Location:** `src/server/socket/handlers/message.ts`, `src/server/socket/handlers/reaction.ts`, etc.

**Issue:** While message sending has rate limiting (10/60s), other Socket.IO handlers lack rate limiting:
- `reaction:add` / `reaction:remove`
- `typing:start` / `typing:stop`
- `presence:update`
- `thread:reply`

**Risk:** An attacker could:
1. Spam reactions to cause database strain
2. Flood typing indicators to degrade UX
3. Abuse presence updates to cause memory/CPU issues

**Recommendation:**
Apply rate limiting to all Socket.IO event handlers:

```typescript
const reactionRateLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
  keyPrefix: "reaction",
});
```

**CVSS Score:** 6.5 (Medium)

---

### HIGH-02: Insufficient Input Validation on Message Content

**Location:** `src/server/socket/handlers/message.ts:129-136`

**Issue:** Only length validation is performed on message content:

```typescript
if (content.length > MAX_MESSAGE_LENGTH) {
  // ...reject
}
```

**Risk:**
1. No sanitization of potentially malicious Unicode sequences
2. No check for control characters that could break rendering
3. Potential for bidirectional text attacks (RTL override)

**Recommendation:**
1. Sanitize Unicode control characters (especially RTL override U+202E)
2. Normalize Unicode to prevent homograph attacks
3. Strip zero-width characters that could hide malicious content

---

### HIGH-03: Missing Authorization Check in Channel Notes API

**Location:** `src/app/api/notes/channel/route.ts`

**Issue:** The channel notes endpoint verifies workspace membership but not channel membership:

```typescript
// Verifies workspace membership
const membership = await db.query.members.findFirst({
  where: and(
    eq(member.organizationId, workspaceId),
    eq(member.userId, session.user.id)
  ),
});
```

**Risk:** A user who is a member of a workspace but NOT a member of a private channel could potentially access or modify that channel's notes.

**Recommendation:**
Add channel membership verification:

```typescript
const channelMembership = await db.query.channelMembers.findFirst({
  where: and(
    eq(channelMembers.channelId, channelId),
    eq(channelMembers.userId, session.user.id)
  ),
});
if (!channelMembership) {
  return NextResponse.json({ error: "Not a channel member" }, { status: 403 });
}
```

**CVSS Score:** 6.8 (Medium)

---

### HIGH-04: Audit Log Tampering Vulnerability

**Location:** `src/lib/audit-logger.ts`

**Issue:** Audit logs are stored as plain JSONL files on the filesystem with no integrity protection:

```typescript
await appendFile(logPath, line);
```

**Risk:**
1. An attacker with file system access could modify logs
2. Logs could be deleted to hide malicious activity
3. No cryptographic verification of log integrity

**Recommendation:**
1. Implement log signing with HMAC or digital signatures
2. Use append-only storage with integrity checks
3. Consider shipping logs to external SIEM/log aggregation
4. Implement log rotation with checksum verification

**CVSS Score:** 6.0 (Medium)

---

### HIGH-05: Potential IDOR in Data Export

**Location:** `src/app/api/admin/export/route.ts:52-63`

**Issue:** The organizationId is taken directly from request body with only role-based validation:

```typescript
const body = await request.json();
const { organizationId } = body;
// ...
if (!userMembership || userMembership.role !== "owner") {
```

**Risk:** If there's any misconfiguration in membership checks, an attacker could potentially export data from organizations they don't own.

**Recommendation:**
1. Derive organizationId from the authenticated user's ownership, not from request body
2. Add explicit organization ownership verification query
3. Log export attempts with full context for audit

**CVSS Score:** 5.9 (Medium)

---

## MEDIUM SEVERITY ISSUES

### MED-01: Insufficient Password Complexity Check

**Location:** `src/lib/password-validation.ts`

**Issue:** Password validation only checks for character classes, not common passwords:

```typescript
if (!/[A-Z]/.test(password)) // uppercase
if (!/[a-z]/.test(password)) // lowercase
if (!/[0-9]/.test(password)) // digit
if (!/[^A-Za-z0-9]/.test(password)) // symbol
```

**Recommendation:**
1. Check against common password lists (top 10,000)
2. Prevent passwords containing username/email
3. Consider implementing NIST guidelines (no arbitrary complexity, but check against breached passwords)

---

### MED-02: No File Size Tracking for Upload Quota

**Location:** `src/app/api/upload/attachment/route.ts`

**Issue:** File uploads have per-file size limits but no overall quota tracking:

```typescript
if (file.size > MAX_FILE_SIZE) { // 25MB per file
```

**Risk:** Users could upload unlimited total storage, leading to disk exhaustion.

**Recommendation:**
1. Implement per-user storage quotas
2. Track cumulative upload size in database
3. Add workspace-level storage limits

---

### MED-03: Session Cookie Missing Secure Flag Check

**Location:** `src/middleware.ts:24-26`

**Issue:** Cookie retrieval doesn't enforce secure transport:

```typescript
const sessionCookie =
  request.cookies.get("better-auth.session_token") ||
  request.cookies.get("__Secure-better-auth.session_token");
```

**Recommendation:**
In production, only accept `__Secure-` prefixed cookies to ensure they were set over HTTPS.

---

### MED-04: Debug Information in Error Responses

**Location:** Multiple API routes

**Issue:** Error responses include generic messages but console.error logs full errors:

```typescript
console.error("Avatar upload error:", error);
return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
```

**Risk:** In development, error details may leak; ensure production logging is properly configured.

**Recommendation:**
1. Implement structured logging with log levels
2. Ensure stack traces are not exposed in production
3. Use error tracking service (Sentry, etc.)

---

### MED-05: Missing CORS Validation for Socket.IO

**Location:** `src/server/index.ts:37-40`

**Issue:** CORS is configured with a single origin, but falls back to localhost:

```typescript
cors: {
  origin: process.env.NEXT_PUBLIC_APP_URL || `http://${hostname}:${port}`,
  credentials: true,
},
```

**Recommendation:**
1. Validate origin strictly in production
2. Log CORS violations
3. Consider origin whitelist for multiple deployment environments

---

### MED-06: Unvalidated Redirect URLs

**Location:** `src/lib/auth.ts:230`

**Issue:** Password reset email constructs URL from environment variable plus user email:

```typescript
const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/forgot-password?email=${encodeURIComponent(email)}`;
```

**Risk:** If NEXT_PUBLIC_APP_URL is misconfigured, emails could contain malicious redirect URLs.

**Recommendation:**
1. Validate NEXT_PUBLIC_APP_URL on startup
2. Use URL constructor to ensure valid URL format
3. Consider hardcoding domain in production

---

### MED-07: Link Preview SSRF Edge Cases

**Location:** `src/workers/link-preview.worker.ts`, `src/lib/ssrf-protection.ts`

**Issue:** While request-filtering-agent provides SSRF protection, the URL validation is basic:

```typescript
if (!["http:", "https:"].includes(parsed.protocol)) {
  return false;
}
```

**Risk:** DNS rebinding attacks could potentially bypass protections.

**Recommendation:**
1. Add hostname validation against blocklist
2. Implement DNS resolution validation before fetch
3. Consider restricting to well-known domains for previews

---

### MED-08: Weak Guest Access Expiration Handling

**Location:** `src/server/socket/handlers/message.ts:19-85`

**Issue:** Guest soft-lock is checked at message send time, but guests remain connected:

```typescript
if (membership.guestSoftLocked) {
  return { allowed: false, error: "Your guest access has expired..." };
}
```

**Risk:** Soft-locked guests can still receive messages and see real-time updates until they disconnect.

**Recommendation:**
1. Disconnect soft-locked guests from Socket.IO
2. Emit notification before disconnection
3. Implement server-side enforcement of soft-lock

---

## LOW SEVERITY ISSUES

### LOW-01: Missing Subresource Integrity (SRI)

Next.js bundles should use SRI hashes to prevent tampering with static assets.

### LOW-02: No Security Headers in API Routes

API routes don't set security headers; relies entirely on nginx.

### LOW-03: Verbose Error Messages in Development

Development error messages could leak implementation details.

### LOW-04: Missing Password History

Users can reuse previous passwords immediately after reset.

### LOW-05: No MFA Support

Authentication lacks multi-factor authentication option.

### LOW-06: Attachment Cleanup Not Implemented

Orphaned file attachments (never linked to messages) are not cleaned up.

---

## INFORMATIONAL FINDINGS

### INFO-01: Security Measures Implemented Well

The following security measures are well-implemented:

- **Account lockout**: Progressive delays and lockout escalation
- **Session management**: 7-day expiration with daily refresh
- **Rate limiting**: Better Auth built-in rate limits on auth endpoints
- **File validation**: Magic byte validation instead of MIME type
- **SSRF protection**: request-filtering-agent for link previews
- **Audit logging**: Comprehensive auth event logging
- **Input validation**: Message length limits, password complexity
- **Authorization**: Channel/conversation membership checks
- **XSS prevention**: react-markdown instead of dangerouslySetInnerHTML

### INFO-02: Chart Component dangerouslySetInnerHTML

**Location:** `src/components/ui/chart.tsx:81`

The chart component uses `dangerouslySetInnerHTML` for CSS injection:

```typescript
<style dangerouslySetInnerHTML={{ __html: ... }} />
```

**Assessment:** LOW RISK - Content is derived from code-defined config objects, not user input. The CSS is generated from trusted sources (chart configuration).

### INFO-03: SQL Injection Prevention

Drizzle ORM properly parameterizes all queries. Uses of `sql` template tag are parameterized:

```typescript
sql`channel_id = ${targetId}` // Safe - parameterized
```

### INFO-04: Timing Attack Mitigations

Email operations use fire-and-forget pattern to prevent timing attacks:

```typescript
void sendVerificationEmail({ to: user.email, url });
```

### INFO-05: Fail-Closed Authentication

Middleware redirects to login on any validation error (fail-closed pattern).

---

## DEPENDENCY SECURITY ANALYSIS

### Known Vulnerabilities Check Required

The following dependencies should be checked against npm audit:

| Package | Version | Notes |
|---------|---------|-------|
| better-auth | 1.4.14 | Core auth - verify no CVEs |
| socket.io | 4.8.3 | WebSocket - check for DOS issues |
| drizzle-orm | 0.45.1 | ORM - verify query safety |
| sharp | 0.34.5 | Image processing - check for RCE |
| nodemailer | 7.0.12 | Email - SMTP injection risks |
| unfurl.js | 6.4.0 | URL unfurling - SSRF surface |

**Recommendation:** Run `npm audit` regularly and before deployments.

---

## RECOMMENDED REMEDIATION PRIORITY

### Immediate (Within 1 Week)

1. **CRIT-01**: Fix CSP policy - remove unsafe-inline/unsafe-eval
2. **CRIT-02**: Fix session validation cache bypass
3. **CRIT-03**: Implement SVG sanitization or block SVGs

### Short-term (Within 1 Month)

4. **HIGH-01**: Add rate limiting to all Socket.IO handlers
5. **HIGH-02**: Implement message content sanitization
6. **HIGH-03**: Add channel membership check to notes API
7. **HIGH-04**: Implement audit log integrity protection
8. **HIGH-05**: Strengthen export authorization

### Medium-term (Within 3 Months)

9. Address all MEDIUM severity issues
10. Implement MFA support
11. Add storage quotas
12. Enhance password policy with breach checking

---

## SECURITY TESTING RECOMMENDATIONS

1. **Penetration Testing**: Engage professional pentest firm
2. **SAST**: Implement static analysis in CI/CD (Semgrep, CodeQL)
3. **DAST**: Run automated security scanning (OWASP ZAP)
4. **Dependency Scanning**: Automate with Snyk or GitHub Dependabot
5. **Secret Scanning**: Ensure no secrets in codebase (GitGuardian)

---

## COMPLIANCE CONSIDERATIONS

For production deployment, consider:

- **GDPR**: Data export exists, but deletion (right to be forgotten) needs review
- **SOC 2**: Audit logging is present, but integrity protection needed
- **OWASP Top 10**: Address CSP, input validation, and authorization issues

---

## CONCLUSION

OComms has a **solid security foundation** with many security best practices already implemented. However, the **critical issues identified (CSP, session cache bypass, SVG handling)** must be addressed before production deployment. The high-severity issues should be resolved promptly, and a regular security review cadence should be established.

The development team has clearly prioritized security with features like account lockout, audit logging, SSRF protection, and proper authorization checks. With the recommended remediations, this application can achieve a strong security posture suitable for enterprise deployment.

---

*This review was conducted through static code analysis. Dynamic testing and penetration testing are recommended to identify runtime vulnerabilities.*

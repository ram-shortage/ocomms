# Phase 12: Authentication Hardening - Research

**Researched:** 2026-01-18
**Domain:** Authentication security (password validation, account lockout)
**Confidence:** MEDIUM

## Summary

This research investigates how to implement authentication hardening in the existing better-auth setup. The project uses better-auth v1.4.14 with Drizzle ORM and PostgreSQL. Key findings:

1. **Password validation**: better-auth only provides `minPasswordLength` and `maxPasswordLength` built-in. For complexity rules (uppercase, lowercase, number, symbol), custom validation must be implemented via `hooks.before` on signup/password-change endpoints OR client-side with server verification.

2. **Account lockout**: better-auth does NOT have built-in account lockout functionality. It only provides rate limiting per endpoint. A custom solution is required: add lockout fields to the user schema, implement a before-hook to check/track failed attempts, and add progressive delay logic.

3. **Password strength UI**: Use zxcvbn library for scoring (0-4 scale) with the existing Radix UI primitives (Progress component) to build a real-time strength indicator.

**Primary recommendation:** Implement custom hooks for lockout tracking and password complexity validation, using the existing email infrastructure for unlock notifications.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | ^1.4.14 | Authentication framework | Already integrated, provides hooks API |
| drizzle-orm | ^0.45.1 | Database ORM | Already integrated, schema extension needed |
| nodemailer | ^7.0.12 | Email sending | Already configured for verification/invites |
| @radix-ui/* | various | UI primitives | Already used for all form components |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zxcvbn | ^4.4.2 | Password strength estimation | Real-time client-side password scoring |
| @radix-ui/react-progress | ^1.1.4 | Progress bar primitive | Password strength meter UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zxcvbn | Custom regex checks | zxcvbn provides smarter scoring based on patterns, not just character types |
| Custom lockout | better-auth rate limiting | Rate limiting is IP-based; need account-based lockout per requirements |

**Installation:**
```bash
npm install zxcvbn @radix-ui/react-progress
npm install -D @types/zxcvbn
```

## Architecture Patterns

### Schema Extension for Lockout Tracking

The existing `users` table needs extension. Since better-auth owns the core schema, add a separate lockout table:

```typescript
// src/db/schema/lockout.ts
import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userLockout = pgTable("user_lockouts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lastFailedAt: timestamp("last_failed_at"),
  lockedUntil: timestamp("locked_until"),
  lockoutCount: integer("lockout_count").notNull().default(0), // For progressive escalation
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Pattern 1: Before Hook for Login Interception

**What:** Intercept sign-in requests to check lockout status and track failures
**When to use:** Every login attempt
**Example:**
```typescript
// Source: https://www.better-auth.com/docs/concepts/hooks
import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";

export const auth = betterAuth({
  // ... existing config
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/email") {
        const email = ctx.body?.email;
        // Check if user is locked out
        // Return early with error if locked
        // Otherwise, let request proceed
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/email") {
        const response = ctx.context.returned;
        // If login failed (INVALID_EMAIL_OR_PASSWORD), increment failure count
        // If login succeeded, reset failure count
      }
    }),
  },
});
```

### Pattern 2: Password Complexity Validation

**What:** Validate password meets complexity requirements before signup/change
**When to use:** Signup and password change endpoints
**Example:**
```typescript
// Source: https://www.better-auth.com/docs/concepts/hooks
hooks: {
  before: createAuthMiddleware(async (ctx) => {
    if (ctx.path === "/sign-up/email" || ctx.path === "/change-password") {
      const password = ctx.body?.password || ctx.body?.newPassword;
      const errors = validatePasswordComplexity(password);
      if (errors.length > 0) {
        throw new APIError("BAD_REQUEST", {
          message: errors.join(", "),
        });
      }
    }
  }),
}

function validatePasswordComplexity(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Password must be at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("Password needs an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Password needs a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Password needs a number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password needs a symbol");
  return errors;
}
```

### Pattern 3: Progressive Delay Implementation

**What:** Add increasing delays between login attempts before hard lockout
**When to use:** Between failed attempts 1-4 (before 5th triggers lockout)
**Example:**
```typescript
// Calculate delay based on failed attempts
function getProgressiveDelay(failedAttempts: number): number {
  // 0 attempts: no delay
  // 1 attempt: 1 second
  // 2 attempts: 2 seconds
  // 3 attempts: 5 seconds
  // 4 attempts: 10 seconds
  // 5+ attempts: lockout (no delay calculation needed)
  const delays = [0, 1000, 2000, 5000, 10000];
  return delays[Math.min(failedAttempts, delays.length - 1)];
}

// In the before hook, check if enough time has passed
const timeSinceLastFailure = Date.now() - lastFailedAt.getTime();
const requiredDelay = getProgressiveDelay(failedAttempts);
if (timeSinceLastFailure < requiredDelay) {
  throw new APIError("TOO_MANY_REQUESTS", {
    message: "Please wait before trying again",
  });
}
```

### Pattern 4: Password Strength Meter Component

**What:** Real-time visual feedback on password strength
**When to use:** Signup form, password change form
**Example:**
```typescript
// Source: https://github.com/dropbox/zxcvbn
import zxcvbn from "zxcvbn";

function PasswordStrengthMeter({ password }: { password: string }) {
  const result = password ? zxcvbn(password) : null;
  const score = result?.score ?? 0; // 0-4

  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"];

  return (
    <div>
      <Progress value={(score + 1) * 20} className={colors[score]} />
      <span>{labels[score]}</span>
      {result?.feedback.warning && <p>{result.feedback.warning}</p>}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Storing plaintext failure reasons:** Don't reveal whether email exists via different error messages
- **IP-based lockout only:** Attackers use proxies; account-based lockout is more robust
- **Synchronous delay in response:** Use async/await with setTimeout, not blocking
- **Checking lockout after password verification:** Check lockout FIRST to prevent timing attacks

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password strength scoring | Custom regex scoring | zxcvbn | Detects patterns, dictionary words, keyboard sequences that regex misses |
| Progress bar UI | Custom div animation | @radix-ui/react-progress | Proper ARIA, accessibility, smooth animations |
| Email sending | Raw SMTP calls | nodemailer (already in project) | Connection pooling, error handling, template support |
| Password hashing | Custom crypto | better-auth built-in (scrypt) | Memory-hard, timing-attack resistant |

**Key insight:** Password strength is not just about character classes. "P@ssw0rd!" has uppercase, lowercase, number, AND symbol but is extremely weak. zxcvbn catches these patterns while regex rules pass them.

## Common Pitfalls

### Pitfall 1: Account Enumeration via Lockout Messages
**What goes wrong:** Different error messages reveal whether account exists ("Account locked" vs "Invalid credentials")
**Why it happens:** Natural desire to be helpful to locked-out users
**How to avoid:** Always return vague error "Unable to log in. If you have an account, check your email for unlock instructions."
**Warning signs:** QA or users asking "why doesn't it say my account is locked?"

### Pitfall 2: Race Condition in Failure Tracking
**What goes wrong:** Two simultaneous login attempts both pass lockout check, both increment counter
**Why it happens:** Check-then-write pattern without locking
**How to avoid:** Use database transactions with SELECT FOR UPDATE, or accept eventual consistency (minor issue for auth)
**Warning signs:** Lockout triggering at 6-7 attempts instead of 5

### Pitfall 3: Progressive Delay Bypass via Parallel Requests
**What goes wrong:** Attacker sends 100 requests simultaneously, all checked before any failure recorded
**Why it happens:** Delay checked against lastFailedAt which hasn't been updated yet
**How to avoid:** Rate limiting at the request level (already configured in better-auth) works alongside account lockout
**Warning signs:** Brute force attacks succeeding despite lockout implementation

### Pitfall 4: Forgetting Password Reset Bypass
**What goes wrong:** User locked out, resets password, still locked out
**Why it happens:** Lockout logic not cleared on password reset
**How to avoid:** Hook into password reset success to clear lockout state
**Warning signs:** Users complaining they're still locked after password reset

### Pitfall 5: zxcvbn Bundle Size Impact
**What goes wrong:** Initial page load slows significantly (400KB gzipped)
**Why it happens:** zxcvbn includes large dictionaries
**How to avoid:** Dynamic import only when password field is focused, code split the component
**Warning signs:** Lighthouse performance score dropping on signup page

## Code Examples

Verified patterns from official sources:

### Unlock Email Template
```typescript
// Source: existing src/lib/email.ts pattern
export async function sendUnlockEmail({
  to,
  unlockUrl,
}: {
  to: string;
  unlockUrl: string;
}) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Account Access - OComms",
    html: `
      <h1>Account Access</h1>
      <p>We noticed multiple failed login attempts on your account.</p>
      <p>If this was you, you can wait for the lockout to expire or reset your password:</p>
      <a href="${unlockUrl}">Reset Password</a>
      <p>If this wasn't you, we recommend changing your password immediately.</p>
    `,
  });
}
```

### Lockout Duration Escalation
```typescript
// Calculate lockout duration based on lockout count
function getLockoutDuration(lockoutCount: number): number {
  // 1st lockout: 15 minutes
  // 2nd lockout: 30 minutes
  // 3rd+ lockout: 1 hour
  const durations = [15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];
  return durations[Math.min(lockoutCount, durations.length - 1)];
}
```

### Client-Side Password Requirements Checklist
```typescript
// Real-time requirements display
function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <ul>
      {requirements.map(({ label, met }) => (
        <li key={label} className={met ? "text-green-600" : "text-gray-400"}>
          {met ? "✓" : "○"} {label}
        </li>
      ))}
    </ul>
  );
}
```

### Admin Unlock Action
```typescript
// Server action for admin unlock
// Source: existing role check pattern from src/app/api/admin/export/route.ts
export async function adminUnlockUser(userId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify admin role (owner/admin can unlock)
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      // Check against target user's organization
    ),
  });

  if (membership?.role !== "owner" && membership?.role !== "admin") {
    throw new Error("Only admins can unlock accounts");
  }

  await db.update(userLockout)
    .set({
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(userLockout.userId, userId));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Strict character class rules only | zxcvbn pattern detection | 2016 (still current) | Allows "correct horse battery staple" style passwords |
| Fixed lockout duration | Progressive escalation | Best practice since ~2020 | Better balance of security and UX |
| IP-based blocking | Account + IP hybrid | Ongoing | Prevents both account enumeration and proxy abuse |
| Immediate lockout | Progressive delays first | Current best practice | Slows attacks without frustrating typo-prone users |

**Deprecated/outdated:**
- MD5/SHA1 password hashing: Use memory-hard algorithms (scrypt, argon2, bcrypt)
- Password expiration policies: NIST 800-63B (2017) recommends against forced rotation

## Open Questions

Things that couldn't be fully resolved:

1. **Admin unlock UI placement**
   - What we know: Role-based access (owner/admin) exists in the codebase
   - What's unclear: Best location for unlock UI (member settings? dedicated admin page?)
   - Recommendation: Add to existing workspace members page with conditional visibility

2. **Password reset flow**
   - What we know: better-auth has `/forgot-password` endpoint (rate limited in auth config)
   - What's unclear: Whether forgot-password page exists in the UI (couldn't find it)
   - Recommendation: May need to build forgot-password page as part of this phase

3. **Change password endpoint scope**
   - What we know: better-auth provides `authClient.changePassword()` requiring current password
   - What's unclear: Whether this validates complexity (likely not without custom hook)
   - Recommendation: Add complexity validation to change-password in the before hook

## Sources

### Primary (HIGH confidence)
- [better-auth hooks documentation](https://www.better-auth.com/docs/concepts/hooks) - Before/after hook patterns
- [better-auth email-password documentation](https://www.better-auth.com/docs/authentication/email-password) - Password options, change password API
- [better-auth security documentation](https://www.better-auth.com/docs/reference/security) - Rate limiting, no built-in lockout
- [better-auth plugins documentation](https://www.better-auth.com/docs/concepts/plugins) - Custom plugin creation patterns
- [zxcvbn GitHub](https://github.com/dropbox/zxcvbn) - Password strength scoring (0-4), feedback API
- [Radix UI Progress](https://www.radix-ui.com/primitives/docs/components/progress) - Progress bar primitive

### Secondary (MEDIUM confidence)
- [Account Lockout Best Practices](https://www.techtarget.com/searchsecurity/tip/Account-lockout-policy-Setup-and-best-practices-explained) - Progressive delay patterns
- [Exponential Backoff for Login](https://infocenter.nokia.com/public/7750SR222R1A/topic/com.nokia.System_Mgmt_Guide/exponential_log-ai9exj5ybz.html) - Backoff algorithm patterns
- [better-auth GitHub discussions](https://github.com/better-auth/better-auth/discussions/3344) - Custom validation patterns

### Tertiary (LOW confidence)
- WebSearch results for React password strength components - Multiple options exist but project should use existing Radix primitives

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - better-auth docs are comprehensive, zxcvbn is well-documented
- Architecture: MEDIUM - Hook patterns verified, but lockout requires custom implementation
- Pitfalls: MEDIUM - Based on general security best practices, not better-auth specific issues

**Research date:** 2026-01-18
**Valid until:** 30 days (better-auth may release lockout plugin)

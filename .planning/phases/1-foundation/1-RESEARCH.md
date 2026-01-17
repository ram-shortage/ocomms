# Phase 1: Foundation - Research

**Researched:** 2026-01-17
**Domain:** Authentication, Database Schema, Multi-tenant Workspaces
**Confidence:** HIGH

## Summary

This research covers the foundational technology stack for OComms: authentication with better-auth, database schema with Drizzle ORM and PostgreSQL, and multi-tenant workspace management. The stack is modern, well-documented, and designed for TypeScript-first development.

Key findings:
- **better-auth** is the recommended auth library (Lucia is deprecated as of March 2025)
- **Drizzle ORM** provides type-safe PostgreSQL access with excellent DX
- better-auth's **Organization plugin** handles workspaces, members, and roles out-of-the-box
- PostgreSQL **Row Level Security (RLS)** provides database-level tenant isolation
- **Next.js 15 App Router** with shadcn/ui for the frontend

**Primary recommendation:** Use better-auth with the Organization plugin for workspaces/members, Drizzle ORM for database access, and PostgreSQL with RLS for tenant isolation. This stack satisfies all Phase 1 requirements with minimal custom code.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | latest | Authentication framework | Comprehensive TypeScript auth, replaces deprecated Lucia, built-in plugins |
| drizzle-orm | v1.0+ | Database ORM | Type-safe, zero dependencies, serverless-ready, SQL-like API |
| drizzle-kit | latest | Migration tooling | Schema-driven migrations, push/generate/migrate workflow |
| postgres | latest | PostgreSQL driver | Fastest JS PostgreSQL client |
| Next.js | 15.x | React framework | App Router, RSC, server actions, production-ready |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @better-auth/cli | latest | Schema generation | Generate auth tables for Drizzle |
| shadcn/ui | latest | UI components | Auth forms, user settings, workspace UI |
| nodemailer | latest | Email sending | Verification emails, password reset |
| multer | 1.5+ | File uploads | Avatar image uploads |
| tailwindcss | 4.x | Styling | Component styling with shadcn |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-auth | NextAuth/Auth.js | better-auth has built-in organization/workspace support; NextAuth requires more custom code |
| better-auth | Lucia | Lucia deprecated March 2025, now educational resource only |
| Drizzle | Prisma | Drizzle is lighter, faster startup, no code-gen step |
| postgres (driver) | pg | postgres.js is faster, but pg has larger ecosystem |

**Installation:**

```bash
# Core dependencies
npm install better-auth drizzle-orm postgres dotenv

# Dev dependencies
npm install -D drizzle-kit @better-auth/cli tsx @types/node

# Frontend/UI
npm install @radix-ui/react-icons lucide-react

# Email & file upload
npm install nodemailer multer
npm install -D @types/nodemailer @types/multer

# Initialize shadcn/ui (run after Next.js setup)
pnpm dlx shadcn@latest init
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/               # Auth route group
│   │   ├── login/
│   │   ├── signup/
│   │   └── verify-email/
│   ├── (workspace)/          # Workspace route group
│   │   └── [workspaceSlug]/
│   ├── api/
│   │   ├── auth/[...all]/    # better-auth handler
│   │   └── upload/           # File upload routes
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                   # shadcn components
│   └── auth/                 # Auth-specific components
├── db/
│   ├── schema/               # Drizzle schema files
│   │   ├── auth.ts           # better-auth tables
│   │   ├── workspace.ts      # Organization tables
│   │   └── index.ts          # Schema exports
│   ├── migrations/           # Generated migrations
│   └── index.ts              # DB connection
├── lib/
│   ├── auth.ts               # better-auth server config
│   ├── auth-client.ts        # better-auth client
│   └── email.ts              # Email sending utilities
└── middleware.ts             # Route protection
```

### Pattern 1: better-auth Server Configuration

**What:** Central auth configuration with email/password and organization plugin
**When to use:** Server-side auth setup (create once)

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // Send password reset email
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Send verification email - don't await to prevent timing attacks
    },
    sendOnSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minute cache
    },
  },
  plugins: [
    organization({
      // Sends invitation emails
      sendInvitationEmail: async ({ invitation, inviter, organization }) => {
        // Send invite email
      },
    }),
  ],
});
```

### Pattern 2: Drizzle Database Connection

**What:** PostgreSQL connection with Drizzle ORM
**When to use:** Database initialization

```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

export const db = drizzle(client, {
  schema,
  casing: "snake_case", // Auto camelCase to snake_case
});
```

### Pattern 3: Multi-tenant RLS Pattern

**What:** Row Level Security for tenant isolation at database level
**When to use:** Any table containing workspace-specific data

```sql
-- Enable RLS on workspace-scoped tables
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create isolation policy
CREATE POLICY workspace_isolation ON messages
  USING (workspace_id = current_setting('app.current_workspace_id')::uuid);

-- Set workspace context before queries
SET app.current_workspace_id = 'workspace-uuid-here';
```

### Pattern 4: Session Access in Server Components

**What:** Access user session in Next.js RSC
**When to use:** Any server component needing auth state

```typescript
// In any server component or server action
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function ProtectedPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return <div>Hello {session.user.name}</div>;
}
```

### Pattern 5: Client-side Auth Hooks

**What:** React hooks for auth state
**When to use:** Client components needing auth

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [organizationClient()],
});

// Usage in client component
const { data: session, isPending } = authClient.useSession();
```

### Anti-Patterns to Avoid

- **Middleware-only auth:** Never rely solely on middleware for security. Always validate sessions at the page/route level.
- **Cookie-only checks:** `getSessionCookie()` only checks cookie existence, not validity. Use `auth.api.getSession()` for real validation.
- **Manual password hashing:** Use better-auth's built-in scrypt hashing. Don't implement custom password handling.
- **Storing images in PostgreSQL:** Use filesystem storage for avatars, store paths in database.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt/argon2 | better-auth scrypt | OWASP-recommended, timing-attack safe |
| Session management | JWT tokens manually | better-auth sessions | Cookie security, refresh logic, revocation built-in |
| Email verification | Custom token generation | better-auth emailVerification | Expiry, signing, URL generation handled |
| Workspace/org structure | Custom tables/logic | better-auth Organization plugin | Roles, invites, members, permissions included |
| Role-based access | Custom RBAC system | better-auth Organization roles | Owner/admin/member with permission hooks |
| Rate limiting | Custom implementation | better-auth built-in | Production-ready, configurable per endpoint |
| File uploads | Manual stream handling | Multer middleware | Battle-tested, size limits, type validation |

**Key insight:** better-auth with the Organization plugin provides 90% of Phase 1 requirements out-of-the-box. Custom code is only needed for email sending integration and avatar storage.

## Common Pitfalls

### Pitfall 1: Missing BETTER_AUTH_SECRET in Production

**What goes wrong:** Auth silently uses default secret, tokens become insecure
**Why it happens:** Dev environment works without explicit secret
**How to avoid:** Set `BETTER_AUTH_SECRET` environment variable with 32+ byte random value
**Warning signs:** Auth works in dev, fails mysteriously in production

```bash
# Generate secure secret
openssl rand -base64 32
```

### Pitfall 2: Lucia Migration Confusion

**What goes wrong:** Starting with Lucia, then needing to migrate
**Why it happens:** Old tutorials/docs reference Lucia
**How to avoid:** Use better-auth from the start; Lucia deprecated March 2025
**Warning signs:** Finding Lucia v3 tutorials, seeing deprecation notices

### Pitfall 3: Drizzle Serial vs Identity Columns

**What goes wrong:** Using deprecated `serial()` for primary keys
**Why it happens:** Old examples use serial pattern
**How to avoid:** Use `generatedAlwaysAsIdentity()` for PostgreSQL IDs
**Warning signs:** Drizzle deprecation warnings

```typescript
// Bad - deprecated
id: serial('id').primaryKey(),

// Good - current best practice
id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
// Or use UUIDs
id: uuid('id').primaryKey().defaultRandom(),
```

### Pitfall 4: Cookie Cache Not Refreshing in RSC

**What goes wrong:** Session appears stale after login
**Why it happens:** Server components can't set cookies
**How to avoid:** Use `router.refresh()` after auth state changes
**Warning signs:** User logged in but pages show logged-out state

### Pitfall 5: Middleware-Only Route Protection

**What goes wrong:** Routes accessible with forged cookies
**Why it happens:** `getSessionCookie()` doesn't validate, just checks existence
**How to avoid:** Always validate with `auth.api.getSession()` in page components
**Warning signs:** Security audit failures, auth bypass reports

### Pitfall 6: Awaiting Email Sends

**What goes wrong:** Timing attacks reveal user existence
**Why it happens:** Response time differs when email is sent vs not
**How to avoid:** Fire-and-forget email sends, use `waitUntil` on serverless
**Warning signs:** Signup response times vary, enumeration attacks succeed

### Pitfall 7: Missing Drizzle Relations

**What goes wrong:** better-auth adapter errors about missing relations
**Why it happens:** Schema generated without relation definitions
**How to avoid:** Run `npx @better-auth/cli generate` to regenerate with relations
**Warning signs:** "undefined is not an object (evaluating 'e._.fullSchema')" error

## Code Examples

Verified patterns from official sources:

### Next.js Route Handler for better-auth

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth.handler);
```

### Email Verification Configuration

```typescript
// In auth configuration
emailVerification: {
  sendOnSignUp: true,
  sendVerificationEmail: async ({ user, url, token }, request) => {
    // Don't await - prevents timing attacks
    void sendVerificationEmail({
      to: user.email,
      subject: "Verify your email",
      verifyUrl: url,
    });
  },
  autoSignInAfterVerification: true,
},
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,
}
```

### Organization/Workspace Setup

```typescript
// Server-side plugin config
plugins: [
  organization({
    sendInvitationEmail: async ({ invitation, inviter, organization }) => {
      void sendInviteEmail({
        to: invitation.email,
        inviterName: inviter.name,
        orgName: organization.name,
        acceptUrl: `${APP_URL}/accept-invite?token=${invitation.id}`,
      });
    },
  }),
]

// Client-side: Create workspace
await authClient.organization.create({
  name: "My Workspace",
  slug: "my-workspace",
});

// Client-side: Invite member
await authClient.organization.inviteMember({
  email: "teammate@example.com",
  role: "member", // or "admin"
});

// Client-side: Update member role
await authClient.organization.updateMemberRole({
  memberId: "member-id",
  role: "admin",
});
```

### Drizzle Schema with Timestamps Pattern

```typescript
// src/db/schema/common.ts
import { timestamp } from "drizzle-orm/pg-core";

export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
};

// Usage in table definition
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => users.id),
  displayName: varchar("display_name", { length: 100 }),
  avatarPath: varchar("avatar_path", { length: 500 }),
  ...timestamps,
});
```

### Drizzle Migration Workflow

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations to database
npx drizzle-kit migrate

# Development: push schema directly (no migration files)
npx drizzle-kit push
```

### Avatar Upload with Multer

```typescript
// src/app/api/upload/avatar/route.ts
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";

const storage = multer.diskStorage({
  destination: "./public/uploads/avatars",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});
```

### Email Sending with Nodemailer

```typescript
// src/lib/email.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendVerificationEmail({
  to,
  subject,
  verifyUrl,
}: {
  to: string;
  subject: string;
  verifyUrl: string;
}) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html: `<p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Lucia Auth | better-auth | March 2025 | Lucia deprecated, migrate to better-auth |
| `serial()` columns | `generatedAlwaysAsIdentity()` | 2024 | PostgreSQL best practice change |
| tailwindcss-animate | tw-animate-css | March 2025 | Tailwind v4 compatibility |
| middleware.ts | proxy.ts | Next.js 16 | Middleware renamed to proxy |
| Manual RBAC | better-auth Organization | 2025 | Built-in roles/permissions |

**Deprecated/outdated:**
- **Lucia Auth:** Now educational resource only, not maintained as library
- **serial() in Drizzle:** Use identity columns instead
- **Pages Router auth patterns:** Use App Router with RSC

## Open Questions

Things that couldn't be fully resolved:

1. **File storage for avatars at scale**
   - What we know: Multer with local filesystem works for single-server deployment
   - What's unclear: How to handle in multi-instance deployment without shared storage
   - Recommendation: Start with local filesystem (`/public/uploads`), plan for S3-compatible storage later

2. **Email provider for self-hosted**
   - What we know: Nodemailer supports any SMTP server
   - What's unclear: Best self-hosted SMTP for production (Postfix? Mailcow?)
   - Recommendation: Use environment variables for SMTP config, let deployers choose

3. **RLS vs Application-level isolation**
   - What we know: RLS provides database-level security, better-auth Organization provides app-level
   - What's unclear: Whether RLS is necessary with better-auth Organization plugin
   - Recommendation: Start with better-auth Organization, add RLS later if needed for defense-in-depth

## Sources

### Primary (HIGH confidence)
- [Better Auth Documentation](https://www.better-auth.com/docs) - Core auth setup, email/password, sessions
- [Better Auth Organization Plugin](https://www.better-auth.com/docs/plugins/organization) - Workspaces, roles, invites
- [Better Auth Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle) - Database integration
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview) - Schema, migrations
- [Drizzle PostgreSQL Setup](https://orm.drizzle.team/docs/get-started/postgresql-new) - Connection, config
- [shadcn/ui Installation](https://ui.shadcn.com/docs/installation/next) - UI component setup
- [Nodemailer SMTP](https://nodemailer.com/smtp) - Email sending

### Secondary (MEDIUM confidence)
- [Better Auth Next.js Integration](https://www.better-auth.com/docs/integrations/next) - Middleware, RSC patterns
- [PostgreSQL RLS for Multi-tenancy](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) - Tenant isolation
- [Drizzle Best Practices Guide 2025](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717) - Schema patterns

### Tertiary (LOW confidence)
- Community discussions on better-auth GitHub about production usage
- Medium articles on Next.js 15 + better-auth integration patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - better-auth and Drizzle are well-documented, official docs verified
- Architecture: HIGH - Patterns from official documentation and examples
- Pitfalls: MEDIUM - Mix of official docs and community reports

**Research date:** 2026-01-17
**Valid until:** 2026-02-17 (30 days - stack is stable)

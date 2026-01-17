---
phase: 1-foundation
plan: 02
type: execute
wave: 2
depends_on: ["1-01"]
files_modified:
  - src/lib/auth.ts
  - src/lib/auth-client.ts
  - src/lib/email.ts
  - src/app/api/auth/[...all]/route.ts
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/signup/page.tsx
  - src/app/(auth)/verify-email/page.tsx
  - src/app/(auth)/layout.tsx
  - src/components/auth/login-form.tsx
  - src/components/auth/signup-form.tsx
  - src/middleware.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - "User can create account with email and password"
    - "User receives verification email after signup"
    - "User can log in with verified account"
    - "Session persists across browser refresh"
    - "User can log out"
  artifacts:
    - path: "src/lib/auth.ts"
      provides: "better-auth server configuration"
      exports: ["auth"]
      contains: "betterAuth"
    - path: "src/lib/auth-client.ts"
      provides: "better-auth client hooks"
      exports: ["authClient"]
      contains: "createAuthClient"
    - path: "src/lib/email.ts"
      provides: "Email sending utility"
      exports: ["sendVerificationEmail", "sendInviteEmail"]
    - path: "src/app/api/auth/[...all]/route.ts"
      provides: "Auth API route handler"
      exports: ["GET", "POST"]
    - path: "src/app/(auth)/login/page.tsx"
      provides: "Login page"
      min_lines: 20
    - path: "src/app/(auth)/signup/page.tsx"
      provides: "Signup page"
      min_lines: 20
  key_links:
    - from: "src/lib/auth.ts"
      to: "src/db/index.ts"
      via: "drizzle adapter import"
      pattern: "import.*db.*from.*@/db"
    - from: "src/app/api/auth/[...all]/route.ts"
      to: "src/lib/auth.ts"
      via: "auth handler import"
      pattern: "import.*auth.*from.*@/lib/auth"
    - from: "src/components/auth/login-form.tsx"
      to: "src/lib/auth-client.ts"
      via: "auth client import"
      pattern: "import.*authClient.*from.*@/lib/auth-client"
---

<objective>
Implement email/password authentication with better-auth including signup, email verification, login, session persistence, and logout.

Purpose: Enable user registration and authentication - the foundation for all user-facing features.
Output: Working auth flow where users can signup, verify email, login, and logout.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/1-foundation/1-RESEARCH.md
@.planning/phases/1-foundation/1-01-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: better-auth Server and Email Configuration</name>
  <files>
    src/lib/auth.ts, src/lib/email.ts, src/app/api/auth/[...all]/route.ts
  </files>
  <action>
    Configure better-auth server with email/password and organization plugin:

    1. Create src/lib/email.ts:
       ```typescript
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
         url,
       }: {
         to: string;
         url: string;
       }) {
         await transporter.sendMail({
           from: process.env.EMAIL_FROM,
           to,
           subject: "Verify your email - OComms",
           html: `
             <h1>Verify your email</h1>
             <p>Click the link below to verify your email address:</p>
             <a href="${url}">Verify Email</a>
             <p>This link expires in 24 hours.</p>
           `,
         });
       }

       export async function sendInviteEmail({
         to,
         inviterName,
         orgName,
         acceptUrl,
       }: {
         to: string;
         inviterName: string;
         orgName: string;
         acceptUrl: string;
       }) {
         await transporter.sendMail({
           from: process.env.EMAIL_FROM,
           to,
           subject: `You've been invited to ${orgName} - OComms`,
           html: `
             <h1>Workspace Invitation</h1>
             <p>${inviterName} has invited you to join ${orgName} on OComms.</p>
             <a href="${acceptUrl}">Accept Invitation</a>
           `,
         });
       }
       ```

    2. Update src/lib/auth.ts with full configuration:
       ```typescript
       import { betterAuth } from "better-auth";
       import { drizzleAdapter } from "better-auth/adapters/drizzle";
       import { organization } from "better-auth/plugins";
       import { db } from "@/db";
       import * as schema from "@/db/schema";
       import { sendVerificationEmail, sendInviteEmail } from "./email";

       export const auth = betterAuth({
         database: drizzleAdapter(db, {
           provider: "pg",
           schema,
         }),
         emailAndPassword: {
           enabled: true,
           requireEmailVerification: true,
           minPasswordLength: 8,
         },
         emailVerification: {
           sendOnSignUp: true,
           sendVerificationEmail: async ({ user, url }) => {
             // Fire-and-forget to prevent timing attacks
             void sendVerificationEmail({ to: user.email, url });
           },
           autoSignInAfterVerification: true,
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
             sendInvitationEmail: async ({ invitation, inviter, organization }) => {
               const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${invitation.id}`;
               void sendInviteEmail({
                 to: invitation.email,
                 inviterName: inviter.user.name || inviter.user.email,
                 orgName: organization.name,
                 acceptUrl,
               });
             },
           }),
         ],
       });
       ```

    3. Create src/app/api/auth/[...all]/route.ts:
       ```typescript
       import { auth } from "@/lib/auth";
       import { toNextJsHandler } from "better-auth/next-js";

       export const { GET, POST } = toNextJsHandler(auth.handler);
       ```

    4. Install nodemailer types if not already:
       ```bash
       npm install nodemailer
       npm install -D @types/nodemailer
       ```
  </action>
  <verify>
    - No TypeScript errors in auth.ts or email.ts
    - API route exists at src/app/api/auth/[...all]/route.ts
    - `npm run build` succeeds (validates imports)
  </verify>
  <done>
    better-auth configured with email/password authentication, email verification,
    and organization plugin. Email utilities ready for verification and invitations.
  </done>
</task>

<task type="auto">
  <name>Task 2: Auth Client and UI Components</name>
  <files>
    src/lib/auth-client.ts, src/app/(auth)/layout.tsx, src/app/(auth)/login/page.tsx,
    src/app/(auth)/signup/page.tsx, src/app/(auth)/verify-email/page.tsx,
    src/components/auth/login-form.tsx, src/components/auth/signup-form.tsx,
    src/middleware.ts
  </files>
  <action>
    Create auth client and UI pages:

    1. Create src/lib/auth-client.ts:
       ```typescript
       import { createAuthClient } from "better-auth/react";
       import { organizationClient } from "better-auth/client/plugins";

       export const authClient = createAuthClient({
         baseURL: process.env.NEXT_PUBLIC_APP_URL,
         plugins: [organizationClient()],
       });

       export const {
         signIn,
         signUp,
         signOut,
         useSession,
         organization,
       } = authClient;
       ```

    2. Add shadcn/ui components needed:
       ```bash
       npx shadcn@latest add button input label card form
       ```

    3. Create src/app/(auth)/layout.tsx:
       ```typescript
       export default function AuthLayout({
         children,
       }: {
         children: React.ReactNode;
       }) {
         return (
           <div className="min-h-screen flex items-center justify-center bg-gray-50">
             <div className="w-full max-w-md p-6">{children}</div>
           </div>
         );
       }
       ```

    4. Create src/components/auth/signup-form.tsx:
       ```typescript
       "use client";

       import { useState } from "react";
       import { useRouter } from "next/navigation";
       import { signUp } from "@/lib/auth-client";
       import { Button } from "@/components/ui/button";
       import { Input } from "@/components/ui/input";
       import { Label } from "@/components/ui/label";
       import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
       import Link from "next/link";

       export function SignupForm() {
         const [email, setEmail] = useState("");
         const [password, setPassword] = useState("");
         const [name, setName] = useState("");
         const [error, setError] = useState("");
         const [loading, setLoading] = useState(false);
         const router = useRouter();

         const handleSubmit = async (e: React.FormEvent) => {
           e.preventDefault();
           setError("");
           setLoading(true);

           try {
             const result = await signUp.email({
               email,
               password,
               name,
             });

             if (result.error) {
               setError(result.error.message || "Signup failed");
             } else {
               router.push("/verify-email?email=" + encodeURIComponent(email));
             }
           } catch (err) {
             setError("An unexpected error occurred");
           } finally {
             setLoading(false);
           }
         };

         return (
           <Card>
             <CardHeader>
               <CardTitle>Create Account</CardTitle>
               <CardDescription>Enter your details to get started</CardDescription>
             </CardHeader>
             <CardContent>
               <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="name">Name</Label>
                   <Input
                     id="name"
                     type="text"
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="email">Email</Label>
                   <Input
                     id="email"
                     type="email"
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="password">Password</Label>
                   <Input
                     id="password"
                     type="password"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     minLength={8}
                     required
                   />
                 </div>
                 {error && <p className="text-sm text-red-600">{error}</p>}
                 <Button type="submit" className="w-full" disabled={loading}>
                   {loading ? "Creating account..." : "Sign Up"}
                 </Button>
               </form>
               <p className="mt-4 text-center text-sm text-gray-600">
                 Already have an account?{" "}
                 <Link href="/login" className="text-blue-600 hover:underline">
                   Log in
                 </Link>
               </p>
             </CardContent>
           </Card>
         );
       }
       ```

    5. Create src/components/auth/login-form.tsx:
       ```typescript
       "use client";

       import { useState } from "react";
       import { useRouter } from "next/navigation";
       import { signIn } from "@/lib/auth-client";
       import { Button } from "@/components/ui/button";
       import { Input } from "@/components/ui/input";
       import { Label } from "@/components/ui/label";
       import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
       import Link from "next/link";

       export function LoginForm() {
         const [email, setEmail] = useState("");
         const [password, setPassword] = useState("");
         const [error, setError] = useState("");
         const [loading, setLoading] = useState(false);
         const router = useRouter();

         const handleSubmit = async (e: React.FormEvent) => {
           e.preventDefault();
           setError("");
           setLoading(true);

           try {
             const result = await signIn.email({
               email,
               password,
             });

             if (result.error) {
               setError(result.error.message || "Login failed");
             } else {
               router.push("/");
               router.refresh();
             }
           } catch (err) {
             setError("An unexpected error occurred");
           } finally {
             setLoading(false);
           }
         };

         return (
           <Card>
             <CardHeader>
               <CardTitle>Welcome Back</CardTitle>
               <CardDescription>Sign in to your account</CardDescription>
             </CardHeader>
             <CardContent>
               <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="email">Email</Label>
                   <Input
                     id="email"
                     type="email"
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="password">Password</Label>
                   <Input
                     id="password"
                     type="password"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     required
                   />
                 </div>
                 {error && <p className="text-sm text-red-600">{error}</p>}
                 <Button type="submit" className="w-full" disabled={loading}>
                   {loading ? "Signing in..." : "Sign In"}
                 </Button>
               </form>
               <p className="mt-4 text-center text-sm text-gray-600">
                 Don't have an account?{" "}
                 <Link href="/signup" className="text-blue-600 hover:underline">
                   Sign up
                 </Link>
               </p>
             </CardContent>
           </Card>
         );
       }
       ```

    6. Create src/app/(auth)/signup/page.tsx:
       ```typescript
       import { SignupForm } from "@/components/auth/signup-form";

       export default function SignupPage() {
         return <SignupForm />;
       }
       ```

    7. Create src/app/(auth)/login/page.tsx:
       ```typescript
       import { LoginForm } from "@/components/auth/login-form";

       export default function LoginPage() {
         return <LoginForm />;
       }
       ```

    8. Create src/app/(auth)/verify-email/page.tsx:
       ```typescript
       import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

       export default function VerifyEmailPage({
         searchParams,
       }: {
         searchParams: { email?: string };
       }) {
         return (
           <Card>
             <CardHeader>
               <CardTitle>Check Your Email</CardTitle>
               <CardDescription>
                 We've sent a verification link to{" "}
                 {searchParams.email || "your email address"}
               </CardDescription>
             </CardHeader>
             <CardContent>
               <p className="text-sm text-gray-600">
                 Click the link in the email to verify your account.
                 The link expires in 24 hours.
               </p>
             </CardContent>
           </Card>
         );
       }
       ```

    9. Create src/middleware.ts for route protection:
       ```typescript
       import { NextResponse } from "next/server";
       import type { NextRequest } from "next/server";

       // Public routes that don't require authentication
       const publicRoutes = ["/login", "/signup", "/verify-email", "/api/auth"];

       export function middleware(request: NextRequest) {
         const { pathname } = request.nextUrl;

         // Allow public routes
         if (publicRoutes.some((route) => pathname.startsWith(route))) {
           return NextResponse.next();
         }

         // Check for session cookie (basic check - full validation in pages)
         const sessionCookie = request.cookies.get("better-auth.session_token");

         if (!sessionCookie) {
           return NextResponse.redirect(new URL("/login", request.url));
         }

         return NextResponse.next();
       }

       export const config = {
         matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
       };
       ```

    10. Update src/app/page.tsx to show auth state:
        ```typescript
        import { auth } from "@/lib/auth";
        import { headers } from "next/headers";
        import { redirect } from "next/navigation";
        import { signOut } from "@/lib/auth-client";

        export default async function HomePage() {
          const session = await auth.api.getSession({
            headers: await headers(),
          });

          if (!session) {
            redirect("/login");
          }

          return (
            <div className="p-8">
              <h1 className="text-2xl font-bold">Welcome, {session.user.name || session.user.email}</h1>
              <p className="mt-2 text-gray-600">You are logged in.</p>
              <form
                action={async () => {
                  "use server";
                  // Server-side logout
                }}
              >
                <LogoutButton />
              </form>
            </div>
          );
        }

        // Client component for logout
        function LogoutButton() {
          return (
            <button
              onClick={() => {
                signOut().then(() => window.location.href = "/login");
              }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Sign Out
            </button>
          );
        }
        ```
        Note: Split LogoutButton into separate client component file if needed.
  </action>
  <verify>
    - Navigate to http://localhost:3000/signup shows signup form
    - Navigate to http://localhost:3000/login shows login form
    - Can fill out signup form (submission will work after SMTP configured)
    - Unauthenticated access to "/" redirects to "/login"
    - No TypeScript errors: `npm run build`
  </verify>
  <done>
    Auth UI complete with signup, login, email verification pages.
    Middleware protects routes. Logout button available on home page.
    Requirements AUTH-01 through AUTH-04 satisfied.
  </done>
</task>

</tasks>

<verification>
Run these commands to verify plan completion:

```bash
# Build succeeds
npm run build

# Dev server
npm run dev &
sleep 5

# Routes exist
curl -s http://localhost:3000/signup | grep -q "Create Account" && echo "Signup page OK"
curl -s http://localhost:3000/login | grep -q "Welcome Back" && echo "Login page OK"

# Redirect works (should get 307 to /login)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "307" && echo "Redirect OK"
```

Manual verification (requires SMTP configured):
1. Sign up with email/password
2. Check email for verification link
3. Click link to verify
4. Log in with credentials
5. Refresh page - session persists
6. Click logout - redirects to login
</verification>

<success_criteria>
- Signup form accepts email, password, name and creates user
- Email verification sent on signup (requires SMTP)
- Login form authenticates user and creates session
- Session persists across browser refresh (cookie-based)
- Logout clears session and redirects to login
- Unauthenticated users redirected to login page
</success_criteria>

<output>
After completion, create `.planning/phases/1-foundation/1-02-SUMMARY.md`
</output>

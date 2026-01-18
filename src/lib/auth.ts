import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { userLockout, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendVerificationEmail, sendInviteEmail } from "./email";
import { validatePasswordComplexity } from "./password-validation";

/**
 * Progressive delay based on failed attempt count.
 * Returns milliseconds to wait before next attempt.
 */
function getProgressiveDelay(failedAttempts: number): number {
  // 0 attempts: no delay
  // 1 attempt: 1 second
  // 2 attempts: 2 seconds
  // 3 attempts: 5 seconds
  // 4+ attempts: 10 seconds
  const delays = [0, 1000, 2000, 5000, 10000];
  return delays[Math.min(failedAttempts, delays.length - 1)];
}

/**
 * Lockout duration based on lockout count (progressive escalation).
 * Returns milliseconds.
 */
function getLockoutDuration(lockoutCount: number): number {
  // 1st lockout: 15 minutes
  // 2nd lockout: 30 minutes
  // 3rd+ lockout: 1 hour
  const durations = [15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];
  return durations[Math.min(lockoutCount, durations.length - 1)];
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: !!process.env.SMTP_HOST, // Only require if SMTP configured
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
  rateLimit: {
    enabled: true,
    window: 60, // seconds
    max: 100, // requests per window
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 5,
      },
      "/sign-up/email": {
        window: 60,
        max: 3,
      },
      "/forgot-password": {
        window: 60,
        max: 3,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Password complexity validation for signup and password change
      if (ctx.path === "/sign-up/email" || ctx.path === "/change-password") {
        const password =
          (ctx.body as { password?: string })?.password ||
          (ctx.body as { newPassword?: string })?.newPassword;
        if (password) {
          const errors = validatePasswordComplexity(password);
          if (errors.length > 0) {
            throw new APIError("BAD_REQUEST", {
              message: errors.join(". "),
            });
          }
        }
      }

      // Account lockout check for sign-in (BEFORE password verification to prevent timing attacks)
      if (ctx.path === "/sign-in/email") {
        const email = (ctx.body as { email?: string })?.email;
        if (!email) return;

        // Look up user by email
        const existingUser = await db.query.user.findFirst({
          where: eq(user.email, email),
        });
        if (!existingUser) return; // User doesn't exist, let request proceed (better-auth handles)

        // Get lockout record
        const lockout = await db.query.userLockout.findFirst({
          where: eq(userLockout.userId, existingUser.id),
        });
        if (!lockout) return; // No lockout record, proceed

        // Check if account is locked
        if (lockout.lockedUntil && lockout.lockedUntil > new Date()) {
          // Use vague error message to prevent account enumeration
          throw new APIError("FORBIDDEN", {
            message: "Unable to log in. Check your email for assistance.",
          });
        }

        // Check progressive delay between attempts
        if (lockout.lastFailedAt && lockout.failedAttempts > 0) {
          const timeSinceLastFailure =
            Date.now() - lockout.lastFailedAt.getTime();
          const requiredDelay = getProgressiveDelay(lockout.failedAttempts);
          if (timeSinceLastFailure < requiredDelay) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Please wait before trying again",
            });
          }
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Track login success/failure for lockout
      if (ctx.path === "/sign-in/email") {
        const email = (ctx.body as { email?: string })?.email;
        if (!email) return;

        // Look up user by email
        const existingUser = await db.query.user.findFirst({
          where: eq(user.email, email),
        });
        if (!existingUser) return; // User doesn't exist, nothing to track

        const response = ctx.context.returned;

        // Determine if login failed by checking response
        // better-auth returns APIError for failed logins (Error object with status/statusCode)
        let loginFailed = false;
        if (response instanceof Error) {
          // Failed login - APIError thrown by better-auth
          loginFailed = true;
        } else if (response instanceof Response) {
          loginFailed = !response.ok;
        } else if (response && typeof response === "object") {
          // Check for error indicators in response object
          const responseObj = response as {
            error?: unknown;
            status?: string;
            statusCode?: number;
          };
          loginFailed =
            "error" in responseObj ||
            responseObj.status === "UNAUTHORIZED" ||
            responseObj.statusCode === 401;
        }

        if (loginFailed) {
          // Increment failed attempts
          const lockout = await db.query.userLockout.findFirst({
            where: eq(userLockout.userId, existingUser.id),
          });

          const newFailedAttempts = (lockout?.failedAttempts ?? 0) + 1;
          const now = new Date();

          if (newFailedAttempts >= 5) {
            // Lock the account
            const currentLockoutCount = lockout?.lockoutCount ?? 0;
            const lockoutDuration = getLockoutDuration(currentLockoutCount);
            const lockedUntil = new Date(Date.now() + lockoutDuration);

            if (lockout) {
              await db
                .update(userLockout)
                .set({
                  failedAttempts: newFailedAttempts,
                  lastFailedAt: now,
                  lockedUntil,
                  lockoutCount: currentLockoutCount + 1,
                  updatedAt: now,
                })
                .where(eq(userLockout.userId, existingUser.id));
            } else {
              await db.insert(userLockout).values({
                userId: existingUser.id,
                failedAttempts: newFailedAttempts,
                lastFailedAt: now,
                lockedUntil,
                lockoutCount: 1,
                updatedAt: now,
              });
            }
            // Email notification will be added in plan 03
          } else {
            // Just increment attempts
            if (lockout) {
              await db
                .update(userLockout)
                .set({
                  failedAttempts: newFailedAttempts,
                  lastFailedAt: now,
                  updatedAt: now,
                })
                .where(eq(userLockout.userId, existingUser.id));
            } else {
              await db.insert(userLockout).values({
                userId: existingUser.id,
                failedAttempts: newFailedAttempts,
                lastFailedAt: now,
                updatedAt: now,
              });
            }
          }
        } else {
          // Login succeeded - reset failed attempts (keep lockoutCount for history)
          const lockout = await db.query.userLockout.findFirst({
            where: eq(userLockout.userId, existingUser.id),
          });

          if (lockout) {
            await db
              .update(userLockout)
              .set({
                failedAttempts: 0,
                lockedUntil: null,
                updatedAt: new Date(),
              })
              .where(eq(userLockout.userId, existingUser.id));
          }
        }
      }
    }),
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

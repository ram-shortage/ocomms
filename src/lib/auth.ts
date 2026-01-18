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

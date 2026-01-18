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

// Password reset - call the API directly since better-auth doesn't export this on client
export async function requestPasswordReset(email: string, redirectTo?: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/request-password-reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, redirectTo }),
  });

  if (!response.ok) {
    throw new Error("Failed to request password reset");
  }

  return response.json();
}

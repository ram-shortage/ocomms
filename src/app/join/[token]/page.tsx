import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getGuestInviteByToken } from "@/lib/actions/guest";
import { JoinWorkspaceButton } from "./join-workspace-button";
import { GuestWelcomeModal } from "./guest-welcome-modal";

/**
 * Guest Invite Redemption Page
 *
 * Flow:
 * 1. Validate invite token
 * 2. If invalid/expired/used: Show error
 * 3. If valid:
 *    a. If not logged in: Redirect to sign up with return URL
 *    b. If logged in: Show welcome page with "Join Workspace" button
 */
export default async function JoinGuestInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Get invite details
  const invite = await getGuestInviteByToken(token);

  // Invalid token
  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Invalid Invite</h1>
          <p className="text-muted-foreground">
            This invite link is invalid or has expired. Please contact the
            workspace admin for a new invite.
          </p>
        </div>
      </div>
    );
  }

  // Already used
  if (invite.isUsed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Invite Already Used</h1>
          <p className="text-muted-foreground">
            This invite link has already been redeemed. If you need access,
            please contact the workspace admin.
          </p>
        </div>
      </div>
    );
  }

  // Expired
  if (invite.isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Invite Expired</h1>
          <p className="text-muted-foreground">
            This invite link has expired. Please contact the workspace admin
            for a new invite.
          </p>
        </div>
      </div>
    );
  }

  // Check if user is logged in
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If not logged in, redirect to sign up with return URL
  if (!session) {
    const returnUrl = encodeURIComponent(`/join/${token}`);
    redirect(`/sign-up?returnUrl=${returnUrl}`);
  }

  // Valid invite + logged in: Show welcome page
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border rounded-lg p-8">
        {/* Workspace info */}
        <div className="text-center mb-6">
          {invite.organization?.logo ? (
            <div className="relative w-16 h-16 mx-auto mb-4">
              <Image
                src={invite.organization.logo}
                alt={invite.organization?.name || "Workspace"}
                fill
                className="object-cover rounded-lg"
              />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {invite.organization?.name?.[0]?.toUpperCase() || "W"}
              </span>
            </div>
          )}
          <h1 className="text-xl font-bold mb-1">
            {invite.organization?.name || "Workspace"}
          </h1>
          <p className="text-muted-foreground">
            You&apos;ve been invited as a guest
          </p>
        </div>

        {/* Channel access info */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium mb-2">
            You&apos;ll have access to:
          </p>
          <div className="flex flex-wrap gap-1">
            {invite.channels.map((channel) => (
              <span
                key={channel.id}
                className="inline-flex items-center px-2 py-1 rounded text-sm bg-background"
              >
                # {channel.name}
              </span>
            ))}
          </div>
          {invite.expiresAt && (
            <p className="text-xs text-muted-foreground mt-3">
              Your access will expire on{" "}
              {new Date(invite.expiresAt).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Join button */}
        <JoinWorkspaceButton
          token={token}
          organizationSlug={invite.organization?.slug || ""}
        />

        <p className="text-xs text-center text-muted-foreground mt-4">
          By joining, you agree to the workspace&apos;s terms of use.
        </p>
      </div>

      {/* Welcome modal (shown on first workspace visit via localStorage) */}
      <GuestWelcomeModal
        workspaceName={invite.organization?.name || "this workspace"}
        channels={invite.channels.map((ch) => ch.name)}
      />
    </div>
  );
}

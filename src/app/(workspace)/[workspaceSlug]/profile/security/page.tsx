"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { MFASetup } from "@/components/settings/mfa-setup";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import Link from "next/link";
import { use } from "react";

export default function SecuritySettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = use(params);
  const router = useRouter();
  const { data: session, isPending } = useSession();

  // Redirect to login if not authenticated
  if (!isPending && !session?.user) {
    router.push("/login");
    return null;
  }

  if (isPending) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-6" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Get MFA status from user record
  const user = session?.user as { twoFactorEnabled?: boolean } | undefined;

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage your account security settings
          </p>
        </div>
        <Link
          href={`/${workspaceSlug}/profile`}
          className="text-sm text-primary hover:underline"
        >
          Back to profile
        </Link>
      </div>

      {/* Change Password section */}
      <div className="bg-card border rounded-lg p-6">
        <ChangePasswordForm />
      </div>

      {/* MFA Setup section */}
      <div className="bg-card border rounded-lg p-6">
        <MFASetup
          enabled={user?.twoFactorEnabled ?? false}
          onStatusChange={() => {
            // Refresh the page to get updated status
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}

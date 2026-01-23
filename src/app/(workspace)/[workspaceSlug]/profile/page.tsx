import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { getProfile, upsertProfile } from "@/lib/profile";
import Link from "next/link";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const profile = await getProfile(session.user.id);

  async function saveProfile(data: { displayName: string; bio: string }) {
    "use server";
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    await upsertProfile(session.user.id, data);
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
      {/* Mobile: stack vertically. Desktop: side by side */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Your Profile</h1>
        <Link
          href={`/${workspaceSlug}`}
          className="text-sm text-primary hover:underline"
        >
          Back to workspace
        </Link>
      </div>
      <div className="bg-card border rounded-lg p-6">
        <ProfileForm
          profile={profile}
          userName={session.user.name}
          onSave={saveProfile}
        />
      </div>

      {/* Security section */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Security</h2>
            <p className="text-sm text-muted-foreground">
              Manage two-factor authentication and security settings
            </p>
          </div>
          <Link
            href={`/${workspaceSlug}/profile/security`}
            className="text-sm text-primary hover:underline"
          >
            Manage
          </Link>
        </div>
      </div>
    </div>
  );
}

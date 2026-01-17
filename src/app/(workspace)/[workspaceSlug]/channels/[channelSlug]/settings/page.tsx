import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getChannel } from "@/lib/actions/channel";
import { ChannelSettings } from "@/components/channel/channel-settings";

export default async function ChannelSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; channelSlug: string }>;
}) {
  const { workspaceSlug, channelSlug } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get organization by slug
  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  });

  const workspace = orgs?.find((org) => org.slug === workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const channel = await getChannel(workspace.id, channelSlug);

  if (!channel) {
    notFound();
  }

  // Check if current user is admin
  const currentMembership = channel.members.find(
    (m) => m.userId === session.user.id
  );

  if (!currentMembership || currentMembership.role !== "admin") {
    redirect(`/${workspaceSlug}/channels/${channelSlug}`);
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-6">
          <Link
            href={`/${workspaceSlug}/channels/${channelSlug}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to #{channel.name}
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">Channel Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage settings for #{channel.name}
          </p>
        </div>

        <ChannelSettings
          channel={{
            id: channel.id,
            name: channel.name,
            description: channel.description,
            isPrivate: channel.isPrivate,
          }}
          members={channel.members.map((m) => ({
            id: m.userId,
            name: m.user.name,
            email: m.user.email,
            image: m.user.image,
            role: m.role,
          }))}
        />

        {/* Delete channel placeholder */}
        <div className="mt-12 pt-8 border-t">
          <h2 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Deleting a channel is permanent and cannot be undone.
          </p>
          <button
            disabled
            className="px-4 py-2 text-sm bg-red-100 text-red-400 rounded-md cursor-not-allowed"
          >
            Delete Channel (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
}

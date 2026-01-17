import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getChannel } from "@/lib/actions/channel";
import { ChannelHeader } from "@/components/channel/channel-header";

export default async function ChannelPage({
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

  // Find current user's membership
  const currentMembership = channel.members.find(
    (m) => m.userId === session.user.id
  );

  const isAdmin = currentMembership?.role === "admin";

  return (
    <div className="flex flex-col h-screen">
      <ChannelHeader
        channel={{
          id: channel.id,
          name: channel.name,
          slug: channel.slug,
          topic: channel.topic,
          description: channel.description,
          isPrivate: channel.isPrivate,
          memberCount: channel.members.length,
        }}
        workspaceSlug={workspaceSlug}
        isAdmin={isAdmin}
        members={channel.members.map((m) => ({
          id: m.userId,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
        }))}
      />

      {/* Main content area - messages placeholder */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto text-center py-12">
          <p className="text-muted-foreground">
            Messages coming in Phase 3
          </p>
        </div>
      </div>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChannelDirectory } from "@/components/channel/channel-directory";
import { CreateChannelDialog } from "@/components/channel/create-channel-dialog";
import { ArrowLeft } from "lucide-react";

export default async function ChannelDirectoryPage({
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

  // Get organization by slug
  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  });

  const workspace = orgs?.find((org) => org.slug === workspaceSlug);

  if (!workspace) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <Link
            href={`/${workspaceSlug}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to {workspace.name}
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Channel Directory</h1>
            <p className="text-muted-foreground mt-1">
              Browse and join channels in {workspace.name}
            </p>
          </div>
          <CreateChannelDialog
            organizationId={workspace.id}
            workspaceSlug={workspaceSlug}
          />
        </div>

        <ChannelDirectory
          organizationId={workspace.id}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  );
}

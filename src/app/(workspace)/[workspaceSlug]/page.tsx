import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function WorkspacePage({
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
    <div className="flex-1 overflow-y-auto">
      <div className="p-8">
        <h2 className="text-xl font-semibold mb-4">
          Welcome to {workspace.name}
        </h2>
        <p className="text-muted-foreground">
          Select a channel from the sidebar to start a conversation, or{" "}
          <Link
            href={`/${workspaceSlug}/channels`}
            className="text-blue-600 hover:underline"
          >
            browse all channels
          </Link>{" "}
          to find one to join.
        </p>
      </div>
    </div>
  );
}

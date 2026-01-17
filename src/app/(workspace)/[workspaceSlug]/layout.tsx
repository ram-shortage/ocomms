import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { PresenceWrapper } from "@/components/presence/presence-wrapper";

export default async function WorkspaceSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  // Get workspace members for initial presence
  const membersResponse = await auth.api.listMembers({
    headers: await headers(),
    query: { organizationId: workspace.id },
  });

  const memberUserIds = membersResponse?.members?.map((m) => m.userId) || [];

  return (
    <PresenceWrapper workspaceId={workspace.id} memberUserIds={memberUserIds}>
      {children}
    </PresenceWrapper>
  );
}

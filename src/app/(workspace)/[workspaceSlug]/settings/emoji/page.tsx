import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { organizations, members } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getWorkspaceEmojis } from "@/lib/actions/custom-emoji";
import { EmojiSettingsClient } from "./emoji-settings-client";

interface PageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function EmojiSettingsPage({ params }: PageProps) {
  const { workspaceSlug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  // Get workspace
  const workspace = await db.query.organizations.findFirst({
    where: eq(organizations.slug, workspaceSlug),
  });

  if (!workspace) {
    redirect("/");
  }

  // Get membership
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, session.user.id),
      eq(members.organizationId, workspace.id)
    ),
  });

  if (!membership) {
    redirect("/");
  }

  const isAdmin = membership.role === "admin" || membership.role === "owner";

  // Get emojis
  const emojis = await getWorkspaceEmojis(workspace.id);

  return (
    <EmojiSettingsClient
      workspaceId={workspace.id}
      workspaceSlug={workspaceSlug}
      currentUserId={session.user.id}
      isAdmin={isAdmin}
      initialEmojis={emojis}
    />
  );
}

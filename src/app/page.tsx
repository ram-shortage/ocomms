import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Get user's organizations
  const orgs = await auth.api.listOrganizations({
    headers: await headers(),
  });

  // If user has workspaces, show list or redirect to first one
  if (orgs && orgs.length > 0) {
    // For now, redirect to first workspace
    redirect(`/${orgs[0].slug}`);
  }

  // No workspaces - show create workspace prompt
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome to OComms</h1>
        <p className="text-muted-foreground mb-6">
          Create a workspace to get started
        </p>
        <Link
          href="/create-workspace"
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Create Workspace
        </Link>
      </div>
    </div>
  );
}

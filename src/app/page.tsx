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

  // No workspaces - show create workspace prompt
  if (!orgs || orgs.length === 0) {
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

  // Show workspace picker
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold mb-2 text-center">Your Workspaces</h1>
        <p className="text-muted-foreground mb-6 text-center">
          Select a workspace to continue
        </p>
        <div className="space-y-2">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/${org.slug}`}
              className="block p-4 bg-card border rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                {org.logo ? (
                  <img
                    src={org.logo}
                    alt={org.name}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-medium">{org.name}</h3>
                  <p className="text-sm text-muted-foreground">{org.slug}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/create-workspace"
            className="block text-center px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Create New Workspace
          </Link>
          <Link
            href="/browse-workspaces"
            className="block text-center px-4 py-2 text-primary hover:underline"
          >
            Browse Workspaces
          </Link>
        </div>
      </div>
    </div>
  );
}

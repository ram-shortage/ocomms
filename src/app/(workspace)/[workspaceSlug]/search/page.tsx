import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { searchMessages } from "@/lib/actions/search";
import { SearchResults } from "@/components/search/search-results";
import { SearchInputClient } from "./search-input-client";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { q } = await searchParams;

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

  const organization = orgs?.find((org) => org.slug === workspaceSlug);

  if (!organization) {
    notFound();
  }

  // Execute search if query exists
  const results = q ? await searchMessages(organization.id, q) : [];

  return (
    <div className="flex flex-col h-full p-6">
      <h1 className="text-2xl font-bold mb-4">Search</h1>
      <SearchInputClient workspaceSlug={workspaceSlug} initialQuery={q || ""} />
      <div className="mt-6">
        <SearchResults
          results={results}
          workspaceSlug={workspaceSlug}
          query={q || ""}
        />
      </div>
    </div>
  );
}

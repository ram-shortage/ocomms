import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NoteEditor } from "@/components/notes/note-editor";

interface PageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function PersonalNotesPage({ params }: PageProps) {
  const { workspaceSlug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  // Get workspace (organization) by slug
  const workspace = await db.query.organizations.findFirst({
    where: eq(organizations.slug, workspaceSlug),
  });

  if (!workspace) {
    redirect("/");
  }

  return (
    <div className="flex flex-col h-full">
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">My Notes</h1>
        <p className="text-sm text-muted-foreground">
          Your personal scratchpad for {workspace.name}
        </p>
      </header>
      <div className="flex-1 p-6 overflow-hidden">
        <div className="h-full bg-card rounded-lg border">
          <NoteEditor
            noteType="personal"
            workspaceId={workspace.id}
          />
        </div>
      </div>
    </div>
  );
}

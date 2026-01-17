---
phase: 1-foundation
plan: 03
type: execute
wave: 3
depends_on: ["1-02"]
files_modified:
  - src/app/(workspace)/layout.tsx
  - src/app/(workspace)/[workspaceSlug]/page.tsx
  - src/app/(workspace)/[workspaceSlug]/settings/page.tsx
  - src/app/(workspace)/[workspaceSlug]/settings/members/page.tsx
  - src/app/create-workspace/page.tsx
  - src/app/accept-invite/page.tsx
  - src/components/workspace/create-workspace-form.tsx
  - src/components/workspace/member-list.tsx
  - src/components/workspace/invite-member-form.tsx
  - src/components/workspace/workspace-switcher.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Admin can create a new workspace"
    - "Workspace data is isolated (tenant isolation)"
    - "User can be invited to join workspace via email"
    - "Members have roles: member, admin, owner"
    - "Admin can change member roles"
    - "Admin can remove members from workspace"
  artifacts:
    - path: "src/app/create-workspace/page.tsx"
      provides: "Workspace creation page"
      min_lines: 10
    - path: "src/components/workspace/create-workspace-form.tsx"
      provides: "Workspace creation form"
      contains: "organization.create"
    - path: "src/components/workspace/member-list.tsx"
      provides: "Member list with role management"
      contains: "updateMemberRole"
    - path: "src/components/workspace/invite-member-form.tsx"
      provides: "Member invitation form"
      contains: "inviteMember"
    - path: "src/app/accept-invite/page.tsx"
      provides: "Invitation acceptance page"
      contains: "acceptInvitation"
  key_links:
    - from: "src/components/workspace/create-workspace-form.tsx"
      to: "better-auth organization API"
      via: "authClient.organization.create"
      pattern: "organization\\.create"
    - from: "src/components/workspace/invite-member-form.tsx"
      to: "better-auth organization API"
      via: "authClient.organization.inviteMember"
      pattern: "inviteMember"
    - from: "src/components/workspace/member-list.tsx"
      to: "better-auth organization API"
      via: "authClient.organization.updateMemberRole"
      pattern: "updateMemberRole"
---

<objective>
Implement workspace (organization) management with better-auth Organization plugin: create workspace, invite members, manage roles.

Purpose: Enable team collaboration by allowing users to create workspaces and invite team members with appropriate roles.
Output: Working workspace creation, member invitation via email, and role management (owner/admin/member).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/1-foundation/1-RESEARCH.md
@.planning/phases/1-foundation/1-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Workspace Creation</name>
  <files>
    src/app/create-workspace/page.tsx, src/components/workspace/create-workspace-form.tsx,
    src/app/(workspace)/layout.tsx, src/app/(workspace)/[workspaceSlug]/page.tsx
  </files>
  <action>
    Create workspace creation flow and workspace layout:

    1. Create src/components/workspace/create-workspace-form.tsx:
       ```typescript
       "use client";

       import { useState } from "react";
       import { useRouter } from "next/navigation";
       import { organization } from "@/lib/auth-client";
       import { Button } from "@/components/ui/button";
       import { Input } from "@/components/ui/input";
       import { Label } from "@/components/ui/label";
       import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

       export function CreateWorkspaceForm() {
         const [name, setName] = useState("");
         const [slug, setSlug] = useState("");
         const [error, setError] = useState("");
         const [loading, setLoading] = useState(false);
         const router = useRouter();

         // Auto-generate slug from name
         const handleNameChange = (value: string) => {
           setName(value);
           setSlug(
             value
               .toLowerCase()
               .replace(/[^a-z0-9]+/g, "-")
               .replace(/(^-|-$)/g, "")
           );
         };

         const handleSubmit = async (e: React.FormEvent) => {
           e.preventDefault();
           setError("");
           setLoading(true);

           try {
             const result = await organization.create({
               name,
               slug,
             });

             if (result.error) {
               setError(result.error.message || "Failed to create workspace");
             } else {
               router.push(`/${slug}`);
             }
           } catch (err) {
             setError("An unexpected error occurred");
           } finally {
             setLoading(false);
           }
         };

         return (
           <Card className="max-w-md mx-auto">
             <CardHeader>
               <CardTitle>Create Workspace</CardTitle>
               <CardDescription>
                 Set up a new workspace for your team
               </CardDescription>
             </CardHeader>
             <CardContent>
               <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="name">Workspace Name</Label>
                   <Input
                     id="name"
                     type="text"
                     value={name}
                     onChange={(e) => handleNameChange(e.target.value)}
                     placeholder="Acme Inc"
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="slug">URL Slug</Label>
                   <div className="flex items-center">
                     <span className="text-sm text-gray-500 mr-1">ocomms.app/</span>
                     <Input
                       id="slug"
                       type="text"
                       value={slug}
                       onChange={(e) => setSlug(e.target.value)}
                       placeholder="acme-inc"
                       pattern="[a-z0-9-]+"
                       required
                     />
                   </div>
                 </div>
                 {error && <p className="text-sm text-red-600">{error}</p>}
                 <Button type="submit" className="w-full" disabled={loading}>
                   {loading ? "Creating..." : "Create Workspace"}
                 </Button>
               </form>
             </CardContent>
           </Card>
         );
       }
       ```

    2. Create src/app/create-workspace/page.tsx:
       ```typescript
       import { auth } from "@/lib/auth";
       import { headers } from "next/headers";
       import { redirect } from "next/navigation";
       import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";

       export default async function CreateWorkspacePage() {
         const session = await auth.api.getSession({
           headers: await headers(),
         });

         if (!session) {
           redirect("/login");
         }

         return (
           <div className="min-h-screen flex items-center justify-center bg-gray-50">
             <CreateWorkspaceForm />
           </div>
         );
       }
       ```

    3. Create src/app/(workspace)/layout.tsx:
       ```typescript
       import { auth } from "@/lib/auth";
       import { headers } from "next/headers";
       import { redirect } from "next/navigation";

       export default async function WorkspaceLayout({
         children,
       }: {
         children: React.ReactNode;
       }) {
         const session = await auth.api.getSession({
           headers: await headers(),
         });

         if (!session) {
           redirect("/login");
         }

         return (
           <div className="min-h-screen bg-gray-50">
             {children}
           </div>
         );
       }
       ```

    4. Create src/app/(workspace)/[workspaceSlug]/page.tsx:
       ```typescript
       import { auth } from "@/lib/auth";
       import { headers } from "next/headers";
       import { redirect, notFound } from "next/navigation";
       import Link from "next/link";

       export default async function WorkspacePage({
         params,
       }: {
         params: { workspaceSlug: string };
       }) {
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

         const workspace = orgs?.find((org) => org.slug === params.workspaceSlug);

         if (!workspace) {
           notFound();
         }

         return (
           <div className="p-8">
             <div className="flex justify-between items-center mb-8">
               <h1 className="text-2xl font-bold">{workspace.name}</h1>
               <Link
                 href={`/${params.workspaceSlug}/settings`}
                 className="text-sm text-blue-600 hover:underline"
               >
                 Settings
               </Link>
             </div>
             <p className="text-gray-600">
               Welcome to your workspace. Channels and messages coming soon.
             </p>
           </div>
         );
       }
       ```

    5. Update src/app/page.tsx to handle workspace routing:
       ```typescript
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
           <div className="min-h-screen flex items-center justify-center bg-gray-50">
             <div className="text-center">
               <h1 className="text-2xl font-bold mb-4">Welcome to OComms</h1>
               <p className="text-gray-600 mb-6">
                 Create a workspace to get started
               </p>
               <Link
                 href="/create-workspace"
                 className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
               >
                 Create Workspace
               </Link>
             </div>
           </div>
         );
       }
       ```
  </action>
  <verify>
    - Navigate to /create-workspace shows form
    - Can create workspace (creates organization in database)
    - After creation, redirects to /[slug] workspace page
    - Workspace page shows workspace name
    - Home page redirects to workspace if user has one
  </verify>
  <done>
    Workspace creation flow complete. Users can create workspaces and are
    redirected to their workspace. Satisfies WKSP-01.
  </done>
</task>

<task type="auto">
  <name>Task 2: Member Invitation and Role Management</name>
  <files>
    src/app/(workspace)/[workspaceSlug]/settings/page.tsx,
    src/app/(workspace)/[workspaceSlug]/settings/members/page.tsx,
    src/app/accept-invite/page.tsx,
    src/components/workspace/member-list.tsx,
    src/components/workspace/invite-member-form.tsx
  </files>
  <action>
    Create member management UI with invitations and roles:

    1. Create src/components/workspace/invite-member-form.tsx:
       ```typescript
       "use client";

       import { useState } from "react";
       import { organization } from "@/lib/auth-client";
       import { Button } from "@/components/ui/button";
       import { Input } from "@/components/ui/input";
       import { Label } from "@/components/ui/label";
       import {
         Select,
         SelectContent,
         SelectItem,
         SelectTrigger,
         SelectValue,
       } from "@/components/ui/select";

       // Add shadcn select component: npx shadcn@latest add select

       interface InviteMemberFormProps {
         organizationId: string;
         onInvited?: () => void;
       }

       export function InviteMemberForm({ organizationId, onInvited }: InviteMemberFormProps) {
         const [email, setEmail] = useState("");
         const [role, setRole] = useState<"member" | "admin">("member");
         const [error, setError] = useState("");
         const [success, setSuccess] = useState("");
         const [loading, setLoading] = useState(false);

         const handleSubmit = async (e: React.FormEvent) => {
           e.preventDefault();
           setError("");
           setSuccess("");
           setLoading(true);

           try {
             const result = await organization.inviteMember({
               email,
               role,
               organizationId,
             });

             if (result.error) {
               setError(result.error.message || "Failed to send invitation");
             } else {
               setSuccess(`Invitation sent to ${email}`);
               setEmail("");
               onInvited?.();
             }
           } catch (err) {
             setError("An unexpected error occurred");
           } finally {
             setLoading(false);
           }
         };

         return (
           <form onSubmit={handleSubmit} className="space-y-4">
             <div className="flex gap-4">
               <div className="flex-1">
                 <Label htmlFor="email">Email Address</Label>
                 <Input
                   id="email"
                   type="email"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   placeholder="teammate@example.com"
                   required
                 />
               </div>
               <div className="w-32">
                 <Label htmlFor="role">Role</Label>
                 <Select value={role} onValueChange={(v) => setRole(v as "member" | "admin")}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="member">Member</SelectItem>
                     <SelectItem value="admin">Admin</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="flex items-end">
                 <Button type="submit" disabled={loading}>
                   {loading ? "Sending..." : "Invite"}
                 </Button>
               </div>
             </div>
             {error && <p className="text-sm text-red-600">{error}</p>}
             {success && <p className="text-sm text-green-600">{success}</p>}
           </form>
         );
       }
       ```

    2. Add shadcn select component:
       ```bash
       npx shadcn@latest add select
       ```

    3. Create src/components/workspace/member-list.tsx:
       ```typescript
       "use client";

       import { useState } from "react";
       import { organization } from "@/lib/auth-client";
       import { Button } from "@/components/ui/button";
       import {
         Select,
         SelectContent,
         SelectItem,
         SelectTrigger,
         SelectValue,
       } from "@/components/ui/select";

       interface Member {
         id: string;
         userId: string;
         role: "owner" | "admin" | "member";
         user: {
           id: string;
           name: string | null;
           email: string;
         };
       }

       interface MemberListProps {
         members: Member[];
         organizationId: string;
         currentUserId: string;
         currentUserRole: "owner" | "admin" | "member";
         onMemberUpdated?: () => void;
       }

       export function MemberList({
         members,
         organizationId,
         currentUserId,
         currentUserRole,
         onMemberUpdated,
       }: MemberListProps) {
         const [loading, setLoading] = useState<string | null>(null);

         const canManageRole = (memberRole: string) => {
           // Owner can manage anyone except other owners
           if (currentUserRole === "owner") return memberRole !== "owner";
           // Admin can manage members only
           if (currentUserRole === "admin") return memberRole === "member";
           return false;
         };

         const canRemove = (memberId: string, memberRole: string) => {
           // Can't remove yourself if you're the only owner
           if (memberId === currentUserId && memberRole === "owner") {
             const ownerCount = members.filter((m) => m.role === "owner").length;
             return ownerCount > 1;
           }
           return canManageRole(memberRole);
         };

         const handleRoleChange = async (memberId: string, newRole: "admin" | "member") => {
           setLoading(memberId);
           try {
             await organization.updateMemberRole({
               memberId,
               role: newRole,
               organizationId,
             });
             onMemberUpdated?.();
           } catch (err) {
             console.error("Failed to update role:", err);
           } finally {
             setLoading(null);
           }
         };

         const handleRemove = async (memberId: string) => {
           if (!confirm("Remove this member from the workspace?")) return;

           setLoading(memberId);
           try {
             await organization.removeMember({
               memberId,
               organizationId,
             });
             onMemberUpdated?.();
           } catch (err) {
             console.error("Failed to remove member:", err);
           } finally {
             setLoading(null);
           }
         };

         return (
           <div className="space-y-2">
             {members.map((member) => (
               <div
                 key={member.id}
                 className="flex items-center justify-between p-3 bg-white border rounded"
               >
                 <div>
                   <p className="font-medium">
                     {member.user.name || member.user.email}
                     {member.userId === currentUserId && " (you)"}
                   </p>
                   <p className="text-sm text-gray-500">{member.user.email}</p>
                 </div>
                 <div className="flex items-center gap-2">
                   {canManageRole(member.role) ? (
                     <Select
                       value={member.role}
                       onValueChange={(v) => handleRoleChange(member.id, v as "admin" | "member")}
                       disabled={loading === member.id}
                     >
                       <SelectTrigger className="w-24">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="admin">Admin</SelectItem>
                         <SelectItem value="member">Member</SelectItem>
                       </SelectContent>
                     </Select>
                   ) : (
                     <span className="px-2 py-1 text-sm bg-gray-100 rounded capitalize">
                       {member.role}
                     </span>
                   )}
                   {canRemove(member.id, member.role) && (
                     <Button
                       variant="destructive"
                       size="sm"
                       onClick={() => handleRemove(member.id)}
                       disabled={loading === member.id}
                     >
                       Remove
                     </Button>
                   )}
                 </div>
               </div>
             ))}
           </div>
         );
       }
       ```

    4. Create src/app/(workspace)/[workspaceSlug]/settings/page.tsx:
       ```typescript
       import { auth } from "@/lib/auth";
       import { headers } from "next/headers";
       import { redirect, notFound } from "next/navigation";
       import Link from "next/link";

       export default async function WorkspaceSettingsPage({
         params,
       }: {
         params: { workspaceSlug: string };
       }) {
         const session = await auth.api.getSession({
           headers: await headers(),
         });

         if (!session) {
           redirect("/login");
         }

         return (
           <div className="p-8 max-w-2xl mx-auto">
             <h1 className="text-2xl font-bold mb-6">Workspace Settings</h1>
             <nav className="space-y-2">
               <Link
                 href={`/${params.workspaceSlug}/settings/members`}
                 className="block p-4 bg-white border rounded hover:bg-gray-50"
               >
                 <h3 className="font-medium">Members</h3>
                 <p className="text-sm text-gray-500">
                   Invite members and manage roles
                 </p>
               </Link>
             </nav>
             <div className="mt-6">
               <Link
                 href={`/${params.workspaceSlug}`}
                 className="text-sm text-blue-600 hover:underline"
               >
                 Back to workspace
               </Link>
             </div>
           </div>
         );
       }
       ```

    5. Create src/app/(workspace)/[workspaceSlug]/settings/members/page.tsx:
       ```typescript
       import { auth } from "@/lib/auth";
       import { headers } from "next/headers";
       import { redirect, notFound } from "next/navigation";
       import { MemberList } from "@/components/workspace/member-list";
       import { InviteMemberForm } from "@/components/workspace/invite-member-form";
       import Link from "next/link";

       export default async function MembersSettingsPage({
         params,
       }: {
         params: { workspaceSlug: string };
       }) {
         const session = await auth.api.getSession({
           headers: await headers(),
         });

         if (!session) {
           redirect("/login");
         }

         // Get organization with members
         const orgs = await auth.api.listOrganizations({
           headers: await headers(),
         });

         const workspace = orgs?.find((org) => org.slug === params.workspaceSlug);

         if (!workspace) {
           notFound();
         }

         // Get full organization details with members
         const fullOrg = await auth.api.getFullOrganization({
           query: { organizationId: workspace.id },
           headers: await headers(),
         });

         if (!fullOrg) {
           notFound();
         }

         // Find current user's membership
         const currentMembership = fullOrg.members?.find(
           (m) => m.userId === session.user.id
         );

         const canInvite =
           currentMembership?.role === "owner" ||
           currentMembership?.role === "admin";

         return (
           <div className="p-8 max-w-2xl mx-auto">
             <div className="flex items-center justify-between mb-6">
               <h1 className="text-2xl font-bold">Members</h1>
               <Link
                 href={`/${params.workspaceSlug}/settings`}
                 className="text-sm text-blue-600 hover:underline"
               >
                 Back to settings
               </Link>
             </div>

             {canInvite && (
               <div className="mb-8 p-4 bg-white border rounded">
                 <h2 className="text-lg font-medium mb-4">Invite Member</h2>
                 <InviteMemberForm organizationId={workspace.id} />
               </div>
             )}

             <div>
               <h2 className="text-lg font-medium mb-4">
                 Members ({fullOrg.members?.length || 0})
               </h2>
               <MemberList
                 members={fullOrg.members || []}
                 organizationId={workspace.id}
                 currentUserId={session.user.id}
                 currentUserRole={currentMembership?.role || "member"}
               />
             </div>
           </div>
         );
       }
       ```

    6. Create src/app/accept-invite/page.tsx:
       ```typescript
       "use client";

       import { useEffect, useState } from "react";
       import { useRouter, useSearchParams } from "next/navigation";
       import { organization, useSession } from "@/lib/auth-client";
       import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
       import { Button } from "@/components/ui/button";
       import Link from "next/link";

       export default function AcceptInvitePage() {
         const router = useRouter();
         const searchParams = useSearchParams();
         const token = searchParams.get("token");
         const { data: session, isPending } = useSession();

         const [status, setStatus] = useState<"loading" | "success" | "error" | "login-required">("loading");
         const [error, setError] = useState("");
         const [workspaceSlug, setWorkspaceSlug] = useState("");

         useEffect(() => {
           if (isPending) return;

           if (!session) {
             setStatus("login-required");
             return;
           }

           if (!token) {
             setError("Invalid invitation link");
             setStatus("error");
             return;
           }

           const acceptInvite = async () => {
             try {
               const result = await organization.acceptInvitation({
                 invitationId: token,
               });

               if (result.error) {
                 setError(result.error.message || "Failed to accept invitation");
                 setStatus("error");
               } else {
                 // Get the organization to redirect to
                 const orgs = await organization.list();
                 const newOrg = orgs?.data?.find((o) => o.id === result.data?.organizationId);
                 if (newOrg) {
                   setWorkspaceSlug(newOrg.slug);
                 }
                 setStatus("success");
               }
             } catch (err) {
               setError("An unexpected error occurred");
               setStatus("error");
             }
           };

           acceptInvite();
         }, [session, isPending, token]);

         if (status === "loading") {
           return (
             <div className="min-h-screen flex items-center justify-center">
               <p>Accepting invitation...</p>
             </div>
           );
         }

         if (status === "login-required") {
           return (
             <div className="min-h-screen flex items-center justify-center bg-gray-50">
               <Card className="max-w-md">
                 <CardHeader>
                   <CardTitle>Login Required</CardTitle>
                   <CardDescription>
                     Please log in or create an account to accept this invitation.
                   </CardDescription>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <Link href={`/login?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`}>
                     <Button className="w-full">Log In</Button>
                   </Link>
                   <Link href={`/signup?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`}>
                     <Button variant="outline" className="w-full">Create Account</Button>
                   </Link>
                 </CardContent>
               </Card>
             </div>
           );
         }

         if (status === "error") {
           return (
             <div className="min-h-screen flex items-center justify-center bg-gray-50">
               <Card className="max-w-md">
                 <CardHeader>
                   <CardTitle>Invitation Error</CardTitle>
                   <CardDescription>{error}</CardDescription>
                 </CardHeader>
                 <CardContent>
                   <Link href="/">
                     <Button className="w-full">Go Home</Button>
                   </Link>
                 </CardContent>
               </Card>
             </div>
           );
         }

         return (
           <div className="min-h-screen flex items-center justify-center bg-gray-50">
             <Card className="max-w-md">
               <CardHeader>
                 <CardTitle>Welcome!</CardTitle>
                 <CardDescription>
                   You've successfully joined the workspace.
                 </CardDescription>
               </CardHeader>
               <CardContent>
                 <Link href={workspaceSlug ? `/${workspaceSlug}` : "/"}>
                   <Button className="w-full">Go to Workspace</Button>
                 </Link>
               </CardContent>
             </Card>
           </div>
         );
       }
       ```

    7. Update middleware.ts to allow accept-invite route:
       Add "/accept-invite" to the publicRoutes array (actually it should be protected but need session, so keep it protected but handle redirect in component).
  </action>
  <verify>
    - Navigate to /[slug]/settings/members shows member list
    - Owner/Admin can see invite form
    - Can send invitation (sends email)
    - Invitation link works (accept-invite page)
    - Can change member role (admin <-> member)
    - Can remove member from workspace
    - Owner role protected (can't demote only owner)
  </verify>
  <done>
    Member invitation and role management complete. Satisfies WKSP-02, WKSP-03,
    MEMB-01, MEMB-02, MEMB-03.
  </done>
</task>

</tasks>

<verification>
Run these commands to verify plan completion:

```bash
# Build succeeds
npm run build

# Dev server
npm run dev &
sleep 5

# Routes exist
curl -s http://localhost:3000/create-workspace | grep -q "Create Workspace" && echo "Create page OK"
```

Manual verification flow:
1. Log in as user A
2. Create workspace "Test Workspace"
3. Navigate to /test-workspace/settings/members
4. Invite user B (email)
5. Log in as user B, use invitation link
6. Log in as user A, change user B's role to admin
7. Log in as user A, remove user B from workspace
</verification>

<success_criteria>
- Workspace creation form works and creates organization
- Workspace page accessible at /[slug]
- Members page shows all workspace members
- Admin/Owner can invite new members via email
- Invitation email sent with accept link
- Accept invitation flow works for logged-in users
- Role changes persist (member <-> admin)
- Member removal works
- Owner cannot be demoted if only owner
</success_criteria>

<output>
After completion, create `.planning/phases/1-foundation/1-03-SUMMARY.md`
</output>

---
phase: 1-foundation
plan: 04
type: execute
wave: 4
depends_on: ["1-03"]
files_modified:
  - src/db/schema/profile.ts
  - src/db/schema/index.ts
  - src/app/api/upload/avatar/route.ts
  - src/app/(workspace)/[workspaceSlug]/profile/page.tsx
  - src/app/(workspace)/[workspaceSlug]/members/[memberId]/page.tsx
  - src/components/profile/profile-form.tsx
  - src/components/profile/avatar-upload.tsx
  - src/components/profile/profile-card.tsx
  - public/uploads/avatars/.gitkeep
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Member can create/edit profile with display name"
    - "Member can upload avatar image"
    - "Member can view other members' profiles"
    - "Avatar images stored locally and served correctly"
  artifacts:
    - path: "src/db/schema/profile.ts"
      provides: "Profile table schema"
      contains: "pgTable"
      exports: ["profiles"]
    - path: "src/app/api/upload/avatar/route.ts"
      provides: "Avatar upload endpoint"
      exports: ["POST"]
    - path: "src/components/profile/profile-form.tsx"
      provides: "Profile editing form"
      contains: "displayName"
    - path: "src/components/profile/avatar-upload.tsx"
      provides: "Avatar upload component"
      contains: "input type=\"file\""
    - path: "src/app/(workspace)/[workspaceSlug]/members/[memberId]/page.tsx"
      provides: "Member profile view page"
      min_lines: 20
  key_links:
    - from: "src/components/profile/avatar-upload.tsx"
      to: "src/app/api/upload/avatar/route.ts"
      via: "fetch POST to /api/upload/avatar"
      pattern: "fetch.*api/upload/avatar"
    - from: "src/app/(workspace)/[workspaceSlug]/members/[memberId]/page.tsx"
      to: "src/db/schema/profile.ts"
      via: "query profiles table"
      pattern: "profiles"
---

<objective>
Implement member profiles with display names and avatar uploads, allowing members to customize their profile and view other members' profiles.

Purpose: Enable member identity within workspaces with customizable display names and avatars.
Output: Working profile editing with avatar upload, and ability to view other members' profiles.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/1-foundation/1-RESEARCH.md
@.planning/phases/1-foundation/1-03-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Profile Schema and Avatar Upload API</name>
  <files>
    src/db/schema/profile.ts, src/db/schema/index.ts,
    src/app/api/upload/avatar/route.ts, public/uploads/avatars/.gitkeep
  </files>
  <action>
    Create profile table and avatar upload endpoint:

    1. Create src/db/schema/profile.ts:
       ```typescript
       import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
       import { relations } from "drizzle-orm";
       import { users } from "./auth";

       export const profiles = pgTable("profiles", {
         id: uuid("id").primaryKey().defaultRandom(),
         userId: text("user_id")
           .notNull()
           .references(() => users.id, { onDelete: "cascade" })
           .unique(),
         displayName: varchar("display_name", { length: 100 }),
         avatarPath: varchar("avatar_path", { length: 500 }),
         bio: text("bio"),
         createdAt: timestamp("created_at").defaultNow().notNull(),
         updatedAt: timestamp("updated_at")
           .defaultNow()
           .notNull()
           .$onUpdateFn(() => new Date()),
       });

       export const profilesRelations = relations(profiles, ({ one }) => ({
         user: one(users, {
           fields: [profiles.userId],
           references: [users.id],
         }),
       }));
       ```

    2. Update src/db/schema/index.ts to export profiles:
       ```typescript
       export * from "./auth";
       export * from "./profile";
       ```

    3. Push schema changes:
       ```bash
       npm run db:push
       ```

    4. Create public/uploads/avatars/.gitkeep to track the directory:
       ```bash
       mkdir -p public/uploads/avatars
       touch public/uploads/avatars/.gitkeep
       ```

    5. Add to .gitignore (but keep .gitkeep):
       ```
       # Uploaded files
       public/uploads/avatars/*
       !public/uploads/avatars/.gitkeep
       ```

    6. Install required packages for file upload:
       ```bash
       npm install uuid
       npm install -D @types/uuid
       ```

    7. Create src/app/api/upload/avatar/route.ts:
       ```typescript
       import { NextRequest, NextResponse } from "next/server";
       import { auth } from "@/lib/auth";
       import { headers } from "next/headers";
       import { writeFile, mkdir } from "fs/promises";
       import { join } from "path";
       import { v4 as uuid } from "uuid";
       import { db } from "@/db";
       import { profiles } from "@/db/schema";
       import { eq } from "drizzle-orm";

       const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
       const MAX_SIZE = 2 * 1024 * 1024; // 2MB

       export async function POST(request: NextRequest) {
         try {
           // Verify authentication
           const session = await auth.api.getSession({
             headers: await headers(),
           });

           if (!session) {
             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
           }

           const formData = await request.formData();
           const file = formData.get("file") as File | null;

           if (!file) {
             return NextResponse.json({ error: "No file provided" }, { status: 400 });
           }

           // Validate file type
           if (!ALLOWED_TYPES.includes(file.type)) {
             return NextResponse.json(
               { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
               { status: 400 }
             );
           }

           // Validate file size
           if (file.size > MAX_SIZE) {
             return NextResponse.json(
               { error: "File too large. Maximum size: 2MB" },
               { status: 400 }
             );
           }

           // Generate unique filename
           const ext = file.name.split(".").pop() || "jpg";
           const filename = `${uuid()}.${ext}`;
           const uploadDir = join(process.cwd(), "public", "uploads", "avatars");
           const filepath = join(uploadDir, filename);

           // Ensure upload directory exists
           await mkdir(uploadDir, { recursive: true });

           // Write file to disk
           const bytes = await file.arrayBuffer();
           await writeFile(filepath, Buffer.from(bytes));

           // Path to store in database (public URL path)
           const avatarPath = `/uploads/avatars/${filename}`;

           // Upsert profile with new avatar
           const existingProfile = await db.query.profiles.findFirst({
             where: eq(profiles.userId, session.user.id),
           });

           if (existingProfile) {
             await db
               .update(profiles)
               .set({ avatarPath, updatedAt: new Date() })
               .where(eq(profiles.userId, session.user.id));
           } else {
             await db.insert(profiles).values({
               userId: session.user.id,
               avatarPath,
             });
           }

           return NextResponse.json({ avatarPath });
         } catch (error) {
           console.error("Avatar upload error:", error);
           return NextResponse.json(
             { error: "Failed to upload avatar" },
             { status: 500 }
           );
         }
       }
       ```

    8. Create src/lib/profile.ts for profile queries:
       ```typescript
       import { db } from "@/db";
       import { profiles } from "@/db/schema";
       import { eq } from "drizzle-orm";

       export async function getProfile(userId: string) {
         return db.query.profiles.findFirst({
           where: eq(profiles.userId, userId),
         });
       }

       export async function upsertProfile(
         userId: string,
         data: { displayName?: string; bio?: string; avatarPath?: string }
       ) {
         const existing = await getProfile(userId);

         if (existing) {
           return db
             .update(profiles)
             .set({ ...data, updatedAt: new Date() })
             .where(eq(profiles.userId, userId))
             .returning();
         }

         return db.insert(profiles).values({ userId, ...data }).returning();
       }
       ```
  </action>
  <verify>
    - `npm run db:push` succeeds with profiles table
    - public/uploads/avatars directory exists
    - `curl -X POST /api/upload/avatar` with file returns avatarPath
    - Uploaded files appear in public/uploads/avatars/
  </verify>
  <done>
    Profile schema created and avatar upload endpoint working.
    Files stored locally with UUID names, paths saved to database.
  </done>
</task>

<task type="auto">
  <name>Task 2: Profile UI Components and Pages</name>
  <files>
    src/components/profile/avatar-upload.tsx, src/components/profile/profile-form.tsx,
    src/components/profile/profile-card.tsx,
    src/app/(workspace)/[workspaceSlug]/profile/page.tsx,
    src/app/(workspace)/[workspaceSlug]/members/[memberId]/page.tsx
  </files>
  <action>
    Create profile editing and viewing components:

    1. Create src/components/profile/avatar-upload.tsx:
       ```typescript
       "use client";

       import { useState, useRef } from "react";
       import { Button } from "@/components/ui/button";
       import Image from "next/image";

       interface AvatarUploadProps {
         currentAvatar?: string | null;
         onUploadComplete?: (avatarPath: string) => void;
       }

       export function AvatarUpload({ currentAvatar, onUploadComplete }: AvatarUploadProps) {
         const [preview, setPreview] = useState<string | null>(currentAvatar || null);
         const [uploading, setUploading] = useState(false);
         const [error, setError] = useState("");
         const inputRef = useRef<HTMLInputElement>(null);

         const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
           const file = e.target.files?.[0];
           if (!file) return;

           // Preview
           const reader = new FileReader();
           reader.onload = (e) => setPreview(e.target?.result as string);
           reader.readAsDataURL(file);

           // Upload
           setError("");
           setUploading(true);

           try {
             const formData = new FormData();
             formData.append("file", file);

             const response = await fetch("/api/upload/avatar", {
               method: "POST",
               body: formData,
             });

             const data = await response.json();

             if (!response.ok) {
               throw new Error(data.error || "Upload failed");
             }

             onUploadComplete?.(data.avatarPath);
           } catch (err) {
             setError(err instanceof Error ? err.message : "Upload failed");
             setPreview(currentAvatar || null);
           } finally {
             setUploading(false);
           }
         };

         return (
           <div className="flex flex-col items-center space-y-4">
             <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200">
               {preview ? (
                 <Image
                   src={preview}
                   alt="Avatar"
                   fill
                   className="object-cover"
                 />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-400">
                   <svg
                     className="w-12 h-12"
                     fill="currentColor"
                     viewBox="0 0 24 24"
                   >
                     <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                   </svg>
                 </div>
               )}
             </div>
             <input
               ref={inputRef}
               type="file"
               accept="image/jpeg,image/png,image/webp,image/gif"
               onChange={handleFileSelect}
               className="hidden"
             />
             <Button
               type="button"
               variant="outline"
               size="sm"
               onClick={() => inputRef.current?.click()}
               disabled={uploading}
             >
               {uploading ? "Uploading..." : "Change Avatar"}
             </Button>
             {error && <p className="text-sm text-red-600">{error}</p>}
           </div>
         );
       }
       ```

    2. Create src/components/profile/profile-form.tsx:
       ```typescript
       "use client";

       import { useState } from "react";
       import { useRouter } from "next/navigation";
       import { Button } from "@/components/ui/button";
       import { Input } from "@/components/ui/input";
       import { Label } from "@/components/ui/label";
       import { Textarea } from "@/components/ui/textarea";
       import { AvatarUpload } from "./avatar-upload";

       // Add shadcn textarea: npx shadcn@latest add textarea

       interface ProfileFormProps {
         profile?: {
           displayName?: string | null;
           bio?: string | null;
           avatarPath?: string | null;
         } | null;
         userName?: string | null;
         onSave: (data: { displayName: string; bio: string }) => Promise<void>;
       }

       export function ProfileForm({ profile, userName, onSave }: ProfileFormProps) {
         const [displayName, setDisplayName] = useState(profile?.displayName || userName || "");
         const [bio, setBio] = useState(profile?.bio || "");
         const [avatarPath, setAvatarPath] = useState(profile?.avatarPath || null);
         const [loading, setLoading] = useState(false);
         const [success, setSuccess] = useState(false);
         const router = useRouter();

         const handleSubmit = async (e: React.FormEvent) => {
           e.preventDefault();
           setLoading(true);
           setSuccess(false);

           try {
             await onSave({ displayName, bio });
             setSuccess(true);
             router.refresh();
           } catch (err) {
             console.error("Failed to save profile:", err);
           } finally {
             setLoading(false);
           }
         };

         return (
           <form onSubmit={handleSubmit} className="space-y-6">
             <AvatarUpload
               currentAvatar={avatarPath}
               onUploadComplete={(path) => {
                 setAvatarPath(path);
                 router.refresh();
               }}
             />

             <div className="space-y-2">
               <Label htmlFor="displayName">Display Name</Label>
               <Input
                 id="displayName"
                 type="text"
                 value={displayName}
                 onChange={(e) => setDisplayName(e.target.value)}
                 placeholder="How should we call you?"
                 maxLength={100}
               />
             </div>

             <div className="space-y-2">
               <Label htmlFor="bio">Bio</Label>
               <Textarea
                 id="bio"
                 value={bio}
                 onChange={(e) => setBio(e.target.value)}
                 placeholder="Tell us about yourself..."
                 rows={3}
               />
             </div>

             <div className="flex items-center gap-4">
               <Button type="submit" disabled={loading}>
                 {loading ? "Saving..." : "Save Profile"}
               </Button>
               {success && (
                 <span className="text-sm text-green-600">Profile saved!</span>
               )}
             </div>
           </form>
         );
       }
       ```

    3. Add shadcn textarea component:
       ```bash
       npx shadcn@latest add textarea
       ```

    4. Create src/components/profile/profile-card.tsx:
       ```typescript
       import Image from "next/image";

       interface ProfileCardProps {
         displayName?: string | null;
         email: string;
         avatarPath?: string | null;
         bio?: string | null;
         role?: string;
       }

       export function ProfileCard({
         displayName,
         email,
         avatarPath,
         bio,
         role,
       }: ProfileCardProps) {
         return (
           <div className="bg-white border rounded-lg p-6">
             <div className="flex items-start space-x-4">
               <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                 {avatarPath ? (
                   <Image
                     src={avatarPath}
                     alt={displayName || email}
                     fill
                     className="object-cover"
                   />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-400">
                     <svg
                       className="w-10 h-10"
                       fill="currentColor"
                       viewBox="0 0 24 24"
                     >
                       <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                     </svg>
                   </div>
                 )}
               </div>
               <div className="flex-1 min-w-0">
                 <h2 className="text-xl font-semibold truncate">
                   {displayName || email}
                 </h2>
                 <p className="text-sm text-gray-500">{email}</p>
                 {role && (
                   <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 rounded capitalize">
                     {role}
                   </span>
                 )}
                 {bio && <p className="mt-3 text-gray-600">{bio}</p>}
               </div>
             </div>
           </div>
         );
       }
       ```

    5. Create src/app/(workspace)/[workspaceSlug]/profile/page.tsx:
       ```typescript
       import { auth } from "@/lib/auth";
       import { headers } from "next/headers";
       import { redirect } from "next/navigation";
       import { ProfileForm } from "@/components/profile/profile-form";
       import { getProfile, upsertProfile } from "@/lib/profile";
       import Link from "next/link";

       export default async function ProfilePage({
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

         const profile = await getProfile(session.user.id);

         async function saveProfile(data: { displayName: string; bio: string }) {
           "use server";
           const session = await auth.api.getSession({
             headers: await headers(),
           });

           if (!session) {
             throw new Error("Unauthorized");
           }

           await upsertProfile(session.user.id, data);
         }

         return (
           <div className="p-8 max-w-2xl mx-auto">
             <div className="flex items-center justify-between mb-6">
               <h1 className="text-2xl font-bold">Your Profile</h1>
               <Link
                 href={`/${params.workspaceSlug}`}
                 className="text-sm text-blue-600 hover:underline"
               >
                 Back to workspace
               </Link>
             </div>
             <div className="bg-white border rounded-lg p-6">
               <ProfileForm
                 profile={profile}
                 userName={session.user.name}
                 onSave={saveProfile}
               />
             </div>
           </div>
         );
       }
       ```

    6. Create src/app/(workspace)/[workspaceSlug]/members/[memberId]/page.tsx:
       ```typescript
       import { auth } from "@/lib/auth";
       import { headers } from "next/headers";
       import { redirect, notFound } from "next/navigation";
       import { ProfileCard } from "@/components/profile/profile-card";
       import { db } from "@/db";
       import { profiles } from "@/db/schema";
       import { eq } from "drizzle-orm";
       import Link from "next/link";

       export default async function MemberProfilePage({
         params,
       }: {
         params: { workspaceSlug: string; memberId: string };
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

         // Get full organization to find member
         const fullOrg = await auth.api.getFullOrganization({
           query: { organizationId: workspace.id },
           headers: await headers(),
         });

         const member = fullOrg?.members?.find((m) => m.id === params.memberId);

         if (!member) {
           notFound();
         }

         // Get profile for this member
         const profile = await db.query.profiles.findFirst({
           where: eq(profiles.userId, member.userId),
         });

         return (
           <div className="p-8 max-w-2xl mx-auto">
             <div className="flex items-center justify-between mb-6">
               <h1 className="text-2xl font-bold">Member Profile</h1>
               <Link
                 href={`/${params.workspaceSlug}/settings/members`}
                 className="text-sm text-blue-600 hover:underline"
               >
                 Back to members
               </Link>
             </div>
             <ProfileCard
               displayName={profile?.displayName || member.user.name}
               email={member.user.email}
               avatarPath={profile?.avatarPath}
               bio={profile?.bio}
               role={member.role}
             />
           </div>
         );
       }
       ```

    7. Update member list to link to profiles - update src/components/workspace/member-list.tsx:
       Add to the member row, wrap name in Link:
       ```typescript
       import Link from "next/link";

       // In the component, wrap member name:
       <Link
         href={`/${workspaceSlug}/members/${member.id}`}
         className="font-medium hover:underline"
       >
         {member.user.name || member.user.email}
         {member.userId === currentUserId && " (you)"}
       </Link>
       ```
       Note: Add workspaceSlug prop to MemberList component.

    8. Add link to profile page in workspace layout or navigation.
       Update workspace page to include profile link:
       ```typescript
       <Link
         href={`/${params.workspaceSlug}/profile`}
         className="text-sm text-blue-600 hover:underline"
       >
         Edit Profile
       </Link>
       ```
  </action>
  <verify>
    - Navigate to /[slug]/profile shows profile form
    - Can upload avatar (file appears in public/uploads/avatars/)
    - Can save display name and bio
    - Navigate to /[slug]/members/[memberId] shows member's profile
    - Member list links to profile pages
    - Profile changes persist after page refresh
  </verify>
  <done>
    Profile system complete with avatar upload and display name editing.
    Members can view each other's profiles. Satisfies MEMB-04, MEMB-05, MEMB-06.
  </done>
</task>

</tasks>

<verification>
Run these commands to verify plan completion:

```bash
# Build succeeds
npm run build

# Check schema
npm run db:push

# Verify directory exists
ls -la public/uploads/avatars/
```

Manual verification flow:
1. Log in and navigate to /[slug]/profile
2. Upload an avatar image
3. Enter display name "Test User" and bio "Hello world"
4. Save profile
5. Navigate to /[slug]/settings/members
6. Click on another member's name
7. View their profile (or your own from another view)
8. Verify avatar displays correctly
</verification>

<success_criteria>
- Profile page shows current user's profile for editing
- Avatar upload accepts JPEG, PNG, WebP, GIF up to 2MB
- Uploaded avatars stored in public/uploads/avatars/
- Display name and bio save to database
- Profile changes visible immediately after save
- Other members' profiles viewable at /[slug]/members/[memberId]
- Avatar images display correctly throughout app
</success_criteria>

<output>
After completion, create `.planning/phases/1-foundation/1-04-SUMMARY.md`
</output>

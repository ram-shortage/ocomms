import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function HomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Welcome, {session.user.name || session.user.email}</h1>
      <p className="mt-2 text-gray-600">You are logged in.</p>
      <LogoutButton />
    </div>
  );
}

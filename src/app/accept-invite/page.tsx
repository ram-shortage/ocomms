"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { organization, useSession } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function AcceptInviteContent() {
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
          const orgId = result.data?.invitation?.organizationId;
          const newOrg = orgs?.data?.find((o) => o.id === orgId);
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
      <div className="min-h-screen flex items-center justify-center bg-muted">
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
      <div className="min-h-screen flex items-center justify-center bg-muted">
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
    <div className="min-h-screen flex items-center justify-center bg-muted">
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

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Loading...</p>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AcceptInviteContent />
    </Suspense>
  );
}

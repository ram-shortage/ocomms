"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from "next/link";

/**
 * Client-side redirect URL validation.
 * Mirrors server-side validation in lib/redirect-validation.ts
 * Only allows relative URLs starting with / (same origin).
 */
function isValidReturnUrl(url: string | null): boolean {
  if (!url) return false;
  // Only allow relative URLs starting with / but not // (protocol-relative)
  return url.startsWith("/") && !url.startsWith("//");
}

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [breachWarningOpen, setBreachWarningOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnUrl = searchParams.get("returnUrl");
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // SEC2-14: Validate returnUrl to prevent open redirect attacks
  const returnUrl = useMemo(() =>
    isValidReturnUrl(rawReturnUrl) ? rawReturnUrl : null,
    [rawReturnUrl]
  );

  const handleSubmit = async (e: React.FormEvent, bypassBreachWarning = false) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Use fetch directly to pass bypassBreachWarning flag
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          bypassBreachWarning,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        // Check for password breach warning (SEC2-09)
        if (data.code === "PASSWORD_BREACHED") {
          setBreachWarningOpen(true);
          return;
        }
        setError(data.message || "Signup failed");
      } else {
        // Preserve returnUrl through email verification flow
        const verifyUrl = "/verify-email?email=" + encodeURIComponent(email) +
          (returnUrl ? "&returnUrl=" + encodeURIComponent(returnUrl) : "");
        router.push(verifyUrl);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleChooseDifferentPassword = () => {
    setBreachWarningOpen(false);
    // Focus the password field for user to enter a new password
    setTimeout(() => passwordInputRef.current?.focus(), 100);
  };

  const handleUseAnyway = async () => {
    setBreachWarningOpen(false);
    // Resubmit with bypass flag
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(fakeEvent, true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Enter your details to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              ref={passwordInputRef}
            />
            {password && (
              <div className="space-y-2 pt-1">
                <PasswordStrengthMeter password={password} />
                <PasswordRequirements password={password} />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : "/login"} className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>

      {/* Breach warning dialog (SEC2-09) */}
      <AlertDialog open={breachWarningOpen} onOpenChange={setBreachWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Password Security Warning</AlertDialogTitle>
            <AlertDialogDescription>
              This password has appeared in known data breaches. Using it puts your
              account at higher risk of being compromised. We strongly recommend
              choosing a different password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleChooseDifferentPassword}>
              Choose Different Password
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUseAnyway}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              I understand the risk, use anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

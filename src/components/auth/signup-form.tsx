"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { PasswordRequirements } from "@/components/auth/password-requirements";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawReturnUrl = searchParams.get("returnUrl");

  // SEC2-14: Validate returnUrl to prevent open redirect attacks
  const returnUrl = useMemo(() =>
    isValidReturnUrl(rawReturnUrl) ? rawReturnUrl : null,
    [rawReturnUrl]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        setError(result.error.message || "Signup failed");
      } else {
        // Preserve returnUrl through email verification flow
        const verifyUrl = "/verify-email?email=" + encodeURIComponent(email) +
          (returnUrl ? "&returnUrl=" + encodeURIComponent(returnUrl) : "");
        router.push(verifyUrl);
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
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
    </Card>
  );
}

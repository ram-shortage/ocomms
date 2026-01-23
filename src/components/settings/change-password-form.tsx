"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [breachWarningOpen, setBreachWarningOpen] = useState(false);
  const newPasswordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent, bypassBreachWarning = false) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    // Client-side validation
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/auth/change-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            bypassBreachWarning,
          }),
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Check for password breach warning (SEC2-09)
        if (data.code === "PASSWORD_BREACHED") {
          setBreachWarningOpen(true);
          return;
        }
        setError(data.message || "Failed to change password");
      } else {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onSuccess?.();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleChooseDifferentPassword = () => {
    setBreachWarningOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => newPasswordRef.current?.focus(), 100);
  };

  const handleUseAnyway = async () => {
    setBreachWarningOpen(false);
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(fakeEvent, true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Change Password</h3>
        <p className="text-sm text-muted-foreground">
          Update your password. You will be signed out of other sessions.
        </p>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
            ref={newPasswordRef}
          />
          {newPassword && (
            <div className="space-y-2 pt-1">
              <PasswordStrengthMeter password={newPassword} />
              <PasswordRequirements password={newPassword} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-sm text-red-600">Passwords do not match</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p className="text-sm text-green-600">Password changed successfully!</p>
        )}

        <Button type="submit" disabled={loading}>
          {loading ? "Changing password..." : "Change Password"}
        </Button>
      </form>

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
    </div>
  );
}

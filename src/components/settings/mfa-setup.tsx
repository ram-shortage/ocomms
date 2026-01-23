"use client";

import { useState } from "react";
import * as QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Shield, ShieldCheck } from "lucide-react";

interface MFASetupProps {
  enabled: boolean;
  onStatusChange: () => void;
}

type SetupStep = "idle" | "password" | "qr" | "verify" | "backup" | "complete";

export function MFASetup({ enabled, onStatusChange }: MFASetupProps) {
  const [step, setStep] = useState<SetupStep>("idle");
  const [password, setPassword] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep("idle");
    setPassword("");
    setQrDataUrl(null);
    setTotpUri(null);
    setBackupCodes([]);
    setVerifyCode("");
    setError(null);
  };

  const startSetup = () => {
    setStep("password");
    setError(null);
  };

  const handlePasswordSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        password,
      });

      if (enableError) {
        setError(enableError.message || "Failed to start MFA setup");
        return;
      }

      if (data?.totpURI) {
        // Generate QR code from TOTP URI
        const qr = await QRCode.toDataURL(data.totpURI);
        setQrDataUrl(qr);
        setTotpUri(data.totpURI);
        setBackupCodes(data.backupCodes || []);
        setStep("qr");
      }
    } catch {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await authClient.twoFactor.verifyTotp({
        code: verifyCode,
      });

      if (verifyError) {
        setError(verifyError.message || "Invalid code");
        return;
      }

      setStep("backup");
    } catch {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setStep("complete");
    onStatusChange();
    toast.success("Two-factor authentication enabled");
    resetState();
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      const { error: disableError } = await authClient.twoFactor.disable({
        password,
      });

      if (disableError) {
        toast.error(disableError.message || "Failed to disable MFA");
        return;
      }

      onStatusChange();
      toast.success("Two-factor authentication disabled");
      resetState();
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Backup codes copied to clipboard");
  };

  // Extract secret from TOTP URI for manual entry
  const getManualSecret = () => {
    if (!totpUri) return null;
    const match = totpUri.match(/secret=([^&]+)/);
    return match ? match[1] : null;
  };

  if (enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            Two-Factor Authentication Enabled
          </CardTitle>
          <CardDescription>
            Your account is protected with two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "idle" && (
            <Button variant="destructive" onClick={() => setStep("password")}>
              Disable 2FA
            </Button>
          )}
          {step === "password" && (
            <div className="space-y-4">
              <Label>Enter password to disable 2FA</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <Button onClick={handleDisable} disabled={loading || !password}>
                  {loading ? "Disabling..." : "Confirm Disable"}
                </Button>
                <Button variant="outline" onClick={resetState}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account using an authenticator
          app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "idle" && (
          <Button onClick={startSetup}>
            Enable Two-Factor Authentication
          </Button>
        )}

        {step === "password" && (
          <div className="space-y-4">
            <Label>Enter your password to continue</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button
                onClick={handlePasswordSubmit}
                disabled={loading || !password}
              >
                {loading ? "Loading..." : "Continue"}
              </Button>
              <Button variant="outline" onClick={resetState}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === "qr" && qrDataUrl && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app (Google
              Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="TOTP QR Code"
                className="border rounded"
              />
            </div>
            {getManualSecret() && (
              <p className="text-xs text-muted-foreground text-center">
                Or enter manually: <code className="font-mono">{getManualSecret()}</code>
              </p>
            )}
            <Button onClick={() => setStep("verify")} className="w-full">
              I have scanned the code
            </Button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            <Label>Enter the 6-digit code from your authenticator app</Label>
            <Input
              type="text"
              value={verifyCode}
              onChange={(e) =>
                setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <Button
                onClick={handleVerify}
                disabled={loading || verifyCode.length !== 6}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </Button>
              <Button variant="outline" onClick={() => setStep("qr")}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === "backup" && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Save your backup codes</p>
            <p className="text-sm text-muted-foreground">
              These codes can be used to access your account if you lose your
              authenticator. Each code can only be used once. Store them safely!
            </p>
            <div className="bg-muted p-4 rounded font-mono text-sm">
              {backupCodes.map((code, i) => (
                <div key={i}>{code}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyBackupCodes}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Codes
              </Button>
              <Button onClick={handleComplete}>I have saved my codes</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

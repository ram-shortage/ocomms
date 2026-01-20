"use client";

import { useState, useEffect } from "react";
import type zxcvbnType from "zxcvbn";
import { Progress } from "@/components/ui/progress";

interface PasswordStrengthMeterProps {
  password: string;
}

type ZxcvbnResult = {
  score: 0 | 1 | 2 | 3 | 4;
  feedback: {
    warning: string;
    suggestions: string[];
  };
};

type ZxcvbnFn = typeof zxcvbnType;

const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
const colors = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
];

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const [result, setResult] = useState<ZxcvbnResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [zxcvbnFn, setZxcvbnFn] = useState<ZxcvbnFn | null>(null);

  // Dynamically load zxcvbn on first password character to avoid bundle bloat
  useEffect(() => {
    if (password.length > 0 && !zxcvbnFn) {
      setLoading(true);
      import("zxcvbn").then((mod) => {
        setZxcvbnFn(() => mod.default);
        setLoading(false);
      });
    }
  }, [password, zxcvbnFn]);

  // Calculate score when password changes
  useEffect(() => {
    if (zxcvbnFn && password) {
      setResult(zxcvbnFn(password) as ZxcvbnResult);
    } else if (!password) {
      setResult(null);
    }
  }, [password, zxcvbnFn]);

  if (!password) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-1">
        <Progress value={0} indicatorClassName="bg-muted" />
        <p className="text-xs text-muted-foreground">Checking strength...</p>
      </div>
    );
  }

  const score = result?.score ?? 0;
  const progressValue = (score + 1) * 20;

  return (
    <div className="space-y-1">
      <Progress value={progressValue} indicatorClassName={colors[score]} />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{labels[score]}</span>
      </div>
      {result?.feedback.warning && (
        <p className="text-xs text-amber-600">{result.feedback.warning}</p>
      )}
    </div>
  );
}

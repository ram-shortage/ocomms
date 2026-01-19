"use client";

import { signOut } from "@/lib/auth-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";

interface LogoutButtonProps {
  className?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  children?: React.ReactNode;
}

export function LogoutButton({
  className,
  variant = "destructive",
  children = "Sign Out",
}: LogoutButtonProps) {
  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <Button
      onClick={handleLogout}
      variant={variant}
      className={cn(className)}
    >
      {children}
    </Button>
  );
}

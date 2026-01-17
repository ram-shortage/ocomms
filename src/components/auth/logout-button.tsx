"use client";

import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <Button
      onClick={handleLogout}
      variant="destructive"
      className="mt-4"
    >
      Sign Out
    </Button>
  );
}

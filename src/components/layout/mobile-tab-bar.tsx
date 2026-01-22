"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, AtSign, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileTabBarProps {
  workspaceSlug: string;
}

const tabs = [
  { href: (slug: string) => `/${slug}`, icon: Home, label: "Home" },
  { href: (slug: string) => `/${slug}/dm`, icon: MessageSquare, label: "DMs" },
  { href: (slug: string) => `/${slug}/threads`, icon: AtSign, label: "Mentions" },
  { href: (slug: string) => `/${slug}/search`, icon: Search, label: "Search" },
  { href: (slug: string) => `/${slug}/profile`, icon: User, label: "Profile" },
];

/**
 * Determines if a tab should be highlighted as active based on current pathname.
 * Handles all route cases including subpages and related routes.
 */
function getIsActive(label: string, tabHref: string, pathname: string, workspaceSlug: string): boolean {
  // Exact match always wins
  if (pathname === tabHref) return true;

  switch (label) {
    case "Home":
      // Home is active for workspace root and channels
      return pathname === `/${workspaceSlug}` ||
             pathname.startsWith(`/${workspaceSlug}/channels`);
    case "DMs":
      return pathname.startsWith(`/${workspaceSlug}/dm`);
    case "Mentions":
      return pathname.startsWith(`/${workspaceSlug}/threads`);
    case "Search":
      return pathname.startsWith(`/${workspaceSlug}/search`);
    case "Profile":
      // Profile tab also active for settings (logical grouping)
      return pathname.startsWith(`/${workspaceSlug}/profile`) ||
             pathname.startsWith(`/${workspaceSlug}/settings`);
    default:
      return false;
  }
}

export function MobileTabBar({ workspaceSlug }: MobileTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background
        pb-[env(safe-area-inset-bottom)]
        pl-[env(safe-area-inset-left)]
        pr-[env(safe-area-inset-right)]
        md:hidden"
    >
      <div className="flex h-16 items-center justify-around">
        {tabs.map(({ href, icon: Icon, label }) => {
          const tabHref = href(workspaceSlug);
          const isActive = getIsActive(label, tabHref, pathname, workspaceSlug);

          return (
            <Link
              key={label}
              href={tabHref}
              className={cn(
                "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2",
                "transition-colors hover:bg-accent active:bg-accent",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

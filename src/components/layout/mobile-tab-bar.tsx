"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, AtSign, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileMoreMenu } from "@/components/mobile/mobile-more-menu";

interface MobileTabBarProps {
  workspaceSlug: string;
}

// Primary tabs - reduced to 4 to make room for More button
const tabs = [
  { href: (slug: string) => `/${slug}`, icon: Home, label: "Home" },
  { href: (slug: string) => `/${slug}/dm`, icon: MessageSquare, label: "DMs" },
  { href: (slug: string) => `/${slug}/threads`, icon: AtSign, label: "Mentions" },
  { href: (slug: string) => `/${slug}/search`, icon: Search, label: "Search" },
];

// Routes handled by the More menu (for active state detection)
// These routes highlight the "More" button, not primary tabs
const moreMenuRoutes = [
  "/scheduled",  // Scheduled messages
  "/reminders",  // Reminders page
  "/saved",      // Saved/bookmarked items
  "/notes",      // Personal notes
  "/settings",   // Settings and subpages (/settings/*, /settings/sidebar, etc.)
  "/profile",    // Profile and subpages (/profile/security, etc.)
];

// Routes that don't map to any navigation item (nothing highlights)
// - /members/[memberId] - viewing another user's profile

/**
 * Determines if a tab should be highlighted as active based on current pathname.
 *
 * Navigation state rules:
 * - Home: /workspace, /workspace/channels/*, /workspace/channels/[slug]/settings
 * - DMs: /workspace/dm, /workspace/dm/[conversationId]
 * - Mentions: /workspace/threads
 * - Search: /workspace/search
 * - More button: /workspace/scheduled, /reminders, /saved, /notes, /settings/*, /profile/*
 * - Nothing: /workspace/members/[memberId] (viewing another user)
 */
function getIsActive(label: string, tabHref: string, pathname: string, workspaceSlug: string): boolean {
  // If we're on a More menu route, no primary tab should be highlighted
  // The MobileMoreMenu component handles its own active state
  const isOnMoreRoute = moreMenuRoutes.some(route =>
    pathname.startsWith(`/${workspaceSlug}${route}`)
  );
  if (isOnMoreRoute) return false;

  // Exact match always wins
  if (pathname === tabHref) return true;

  switch (label) {
    case "Home":
      // Home is active for workspace root and all channel routes
      // Including /channels/[slug], /channels/[slug]/settings, etc.
      return pathname === `/${workspaceSlug}` ||
             pathname.startsWith(`/${workspaceSlug}/channels`);
    case "DMs":
      // DMs tab active for /dm and /dm/[conversationId]
      return pathname.startsWith(`/${workspaceSlug}/dm`);
    case "Mentions":
      // Mentions tab active for /threads
      return pathname.startsWith(`/${workspaceSlug}/threads`);
    case "Search":
      // Search tab active for /search
      return pathname.startsWith(`/${workspaceSlug}/search`);
    default:
      // Routes like /members/[memberId] don't highlight any tab
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
        <MobileMoreMenu workspaceSlug={workspaceSlug} />
      </div>
    </nav>
  );
}

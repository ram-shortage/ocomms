"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, Clock, Bell, Bookmark, StickyNote, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface MobileMoreMenuProps {
  workspaceSlug: string;
}

// Items in the More menu
const moreItems = [
  { href: (slug: string) => `/${slug}/scheduled`, icon: Clock, label: "Scheduled Messages" },
  { href: (slug: string) => `/${slug}/reminders`, icon: Bell, label: "Reminders" },
  { href: (slug: string) => `/${slug}/saved`, icon: Bookmark, label: "Saved Items" },
  { href: (slug: string) => `/${slug}/notes`, icon: StickyNote, label: "My Notes" },
  { href: (slug: string) => `/${slug}/settings`, icon: Settings, label: "Settings" },
  { href: (slug: string) => `/${slug}/profile`, icon: User, label: "Profile" },
];

export function MobileMoreMenu({ workspaceSlug }: MobileMoreMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Check if any More menu route is active
  const isMoreActive = moreItems.some(item =>
    pathname.startsWith(item.href(workspaceSlug))
  );

  return (
    <>
      {/* More button - rendered inline in tab bar */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2",
          "transition-colors hover:bg-accent active:bg-accent",
          isMoreActive ? "text-primary" : "text-muted-foreground"
        )}
      >
        <MoreHorizontal className="h-5 w-5" />
        <span className="text-xs">More</span>
      </button>

      {/* More menu drawer */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>More</DrawerTitle>
          </DrawerHeader>
          <nav className="px-4 pb-4 space-y-1">
            {moreItems.map(({ href, icon: Icon, label }) => {
              const itemHref = href(workspaceSlug);
              const isActive = pathname.startsWith(itemHref);

              return (
                <Link
                  key={label}
                  href={itemHref}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 min-h-11 px-4 py-3 rounded-md transition-colors",
                    "hover:bg-accent active:bg-accent",
                    isActive && "bg-accent text-primary font-medium"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </DrawerContent>
      </Drawer>
    </>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CreateCategoryDialog } from "@/components/channel/create-category-dialog";
import { FolderPlus, Eye, EyeOff } from "lucide-react";
import { updateSectionVisibility } from "@/lib/actions/sidebar-preferences";
import { DEFAULT_SECTION_ORDER } from "@/lib/types/sidebar";
import type { SidebarPreferencesData } from "@/lib/types/sidebar";

/**
 * Section labels for display
 */
const SECTION_LABELS: Record<string, string> = {
  threads: "Threads",
  search: "Search",
  notes: "My Notes",
  scheduled: "Scheduled",
  reminders: "Reminders",
  saved: "Saved",
};

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

interface SidebarSettingsClientProps {
  organizationId: string;
  categories: Category[];
  preferences: SidebarPreferencesData | null;
  isAdmin: boolean;
}

/**
 * Client-side sidebar settings component.
 * Handles section visibility toggles and category management.
 */
export function SidebarSettingsClient({
  organizationId,
  categories,
  preferences,
  isAdmin,
}: SidebarSettingsClientProps) {
  const router = useRouter();
  // Initialize hidden sections from preferences or empty array
  const [hiddenSections, setHiddenSections] = useState<string[]>(
    preferences?.hiddenSections ?? []
  );
  const [saving, setSaving] = useState(false);

  const handleSectionToggle = useCallback(
    async (sectionId: string, checked: boolean) => {
      const newHidden = checked
        ? hiddenSections.filter((id) => id !== sectionId)
        : [...hiddenSections, sectionId];

      setHiddenSections(newHidden);
      setSaving(true);

      try {
        await updateSectionVisibility(organizationId, newHidden);
        router.refresh();
      } catch (error) {
        // Revert on error
        setHiddenSections(hiddenSections);
        console.error("Failed to update section visibility:", error);
      } finally {
        setSaving(false);
      }
    },
    [hiddenSections, organizationId, router]
  );

  return (
    <div className="space-y-8">
      {/* Section visibility */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Sidebar Sections</h2>
          <p className="text-sm text-muted-foreground">
            Choose which sections appear in your sidebar. Hidden sections can still be
            accessed through this settings page.
          </p>
        </div>
        <div className="space-y-3">
          {DEFAULT_SECTION_ORDER.map((sectionId) => {
            const isVisible = !hiddenSections.includes(sectionId);
            return (
              <label
                key={sectionId}
                className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-muted cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={isVisible}
                  onCheckedChange={(checked) =>
                    handleSectionToggle(sectionId, checked as boolean)
                  }
                  disabled={saving}
                />
                <div className="flex items-center gap-2 flex-1">
                  {isVisible ? (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{SECTION_LABELS[sectionId] ?? sectionId}</span>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* Category management - admin only */}
      {isAdmin && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Channel Categories</h2>
            <p className="text-sm text-muted-foreground">
              Organize channels into categories for easier navigation.
            </p>
          </div>

          {/* Existing categories list */}
          {categories.length > 0 && (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 p-3 rounded-md border bg-card"
                >
                  <span className="flex-1">{category.name}</span>
                </div>
              ))}
            </div>
          )}

          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No categories created yet. Create one to start organizing channels.
            </p>
          )}

          {/* Create category button - SIDE-01: moved from sidebar */}
          <CreateCategoryDialog
            organizationId={organizationId}
            trigger={
              <Button variant="outline" className="w-full justify-start">
                <FolderPlus className="h-4 w-4 mr-2" />
                New Category
              </Button>
            }
          />
        </section>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { SidebarPreferencesData, DEFAULT_SECTION_ORDER, DEFAULT_MAIN_SECTION_ORDER } from "@/lib/types/sidebar";
import { getSidebarPreferences, saveSidebarPreferences } from "@/lib/actions/sidebar-preferences";

const STORAGE_KEY_PREFIX = "sidebar-prefs-";

function getStorageKey(orgId: string): string {
  return `${STORAGE_KEY_PREFIX}${orgId}`;
}

function getLocalPreferences(orgId: string): SidebarPreferencesData | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(getStorageKey(orgId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setLocalPreferences(orgId: string, prefs: SidebarPreferencesData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(orgId), JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook for managing sidebar preferences with localStorage caching and server sync.
 *
 * SIDE-07: Loads from localStorage for instant UI, syncs from server for persistence.
 * SIDE-08: Uses "last write wins" for cross-device conflict resolution.
 */
export function useSidebarPreferences(organizationId: string) {
  // Initialize from localStorage for instant load
  const [preferences, setPreferences] = useState<SidebarPreferencesData | null>(() =>
    getLocalPreferences(organizationId)
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load from server and sync
  useEffect(() => {
    let cancelled = false;

    async function loadFromServer() {
      try {
        const serverPrefs = await getSidebarPreferences(organizationId);
        if (cancelled) return;

        if (serverPrefs) {
          const local = getLocalPreferences(organizationId);

          // Last write wins: use whichever is newer
          if (!local || new Date(serverPrefs.updatedAt) >= new Date(local.updatedAt)) {
            setPreferences(serverPrefs);
            setLocalPreferences(organizationId, serverPrefs);
          } else {
            // Local is newer, push to server
            await saveSidebarPreferences(organizationId, local);
          }
        }
      } catch (error) {
        console.error("Failed to load sidebar preferences:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadFromServer();
    return () => { cancelled = true; };
  }, [organizationId]);

  // Update helper that saves to both localStorage and server
  const updatePreferences = useCallback(async (updates: Partial<SidebarPreferencesData>) => {
    const newPrefs: SidebarPreferencesData = {
      categoryOrder: preferences?.categoryOrder ?? [],
      dmOrder: preferences?.dmOrder ?? [],
      sectionOrder: preferences?.sectionOrder ?? DEFAULT_SECTION_ORDER,
      hiddenSections: preferences?.hiddenSections ?? [],
      collapsedSections: preferences?.collapsedSections ?? [],
      mainSectionOrder: preferences?.mainSectionOrder ?? DEFAULT_MAIN_SECTION_ORDER,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Optimistic update
    setPreferences(newPrefs);
    setLocalPreferences(organizationId, newPrefs);

    // Persist to server (fire and forget for responsiveness)
    saveSidebarPreferences(organizationId, newPrefs).catch(console.error);
  }, [organizationId, preferences]);

  return {
    preferences,
    isLoading,
    updatePreferences,
    // Convenience getters
    categoryOrder: preferences?.categoryOrder ?? [],
    dmOrder: preferences?.dmOrder ?? [],
    sectionOrder: preferences?.sectionOrder ?? DEFAULT_SECTION_ORDER,
    hiddenSections: preferences?.hiddenSections ?? [],
    collapsedSections: preferences?.collapsedSections ?? [],
    mainSectionOrder: preferences?.mainSectionOrder ?? DEFAULT_MAIN_SECTION_ORDER,
  };
}

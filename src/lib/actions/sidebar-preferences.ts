"use server";

import { db } from "@/db";
import { userSidebarPreferences, members } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import type { SidebarPreferencesData } from "@/lib/types/sidebar";

async function verifyOrgMembership(userId: string, organizationId: string) {
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });
  return membership;
}

/**
 * Get user's sidebar preferences for a workspace.
 * Returns null if no preferences have been saved.
 */
export async function getSidebarPreferences(
  organizationId: string
): Promise<SidebarPreferencesData | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const membership = await verifyOrgMembership(session.user.id, organizationId);
  if (!membership) {
    throw new Error("Not authorized to access this workspace");
  }

  const result = await db.query.userSidebarPreferences.findFirst({
    where: and(
      eq(userSidebarPreferences.userId, session.user.id),
      eq(userSidebarPreferences.organizationId, organizationId)
    ),
  });

  return result?.preferences ?? null;
}

/**
 * Save (upsert) sidebar preferences for a workspace.
 * Merges provided preferences with existing ones.
 */
export async function saveSidebarPreferences(
  organizationId: string,
  preferences: Partial<SidebarPreferencesData>
): Promise<{ success: true }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const membership = await verifyOrgMembership(session.user.id, organizationId);
  if (!membership) {
    throw new Error("Not authorized to access this workspace");
  }

  // Get existing preferences to merge
  const existing = await db.query.userSidebarPreferences.findFirst({
    where: and(
      eq(userSidebarPreferences.userId, session.user.id),
      eq(userSidebarPreferences.organizationId, organizationId)
    ),
  });

  const now = new Date().toISOString();
  const merged: SidebarPreferencesData = {
    categoryOrder: preferences.categoryOrder ?? existing?.preferences.categoryOrder ?? [],
    dmOrder: preferences.dmOrder ?? existing?.preferences.dmOrder ?? [],
    sectionOrder: preferences.sectionOrder ?? existing?.preferences.sectionOrder ?? [],
    hiddenSections: preferences.hiddenSections ?? existing?.preferences.hiddenSections ?? [],
    collapsedSections: preferences.collapsedSections ?? existing?.preferences.collapsedSections ?? [],
    updatedAt: now,
  };

  await db
    .insert(userSidebarPreferences)
    .values({
      userId: session.user.id,
      organizationId,
      preferences: merged,
    })
    .onConflictDoUpdate({
      target: [userSidebarPreferences.userId, userSidebarPreferences.organizationId],
      set: {
        preferences: merged,
        updatedAt: new Date(),
      },
    });

  return { success: true };
}

/**
 * Update category order for a workspace.
 */
export async function updateCategoryOrder(
  organizationId: string,
  categoryOrder: string[]
): Promise<{ success: true }> {
  return saveSidebarPreferences(organizationId, { categoryOrder });
}

/**
 * Update DM order for a workspace.
 */
export async function updateDmOrder(
  organizationId: string,
  dmOrder: string[]
): Promise<{ success: true }> {
  return saveSidebarPreferences(organizationId, { dmOrder });
}

/**
 * Update section order for a workspace.
 */
export async function updateSectionOrder(
  organizationId: string,
  sectionOrder: string[]
): Promise<{ success: true }> {
  return saveSidebarPreferences(organizationId, { sectionOrder });
}

/**
 * Update hidden sections for a workspace.
 */
export async function updateSectionVisibility(
  organizationId: string,
  hiddenSections: string[]
): Promise<{ success: true }> {
  return saveSidebarPreferences(organizationId, { hiddenSections });
}

"use server";

import { db } from "@/db";
import { channelCategories, userCategoryCollapseStates, channels, members, organizations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, max, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function verifyOrgMembership(userId: string, organizationId: string) {
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.organizationId, organizationId)
    ),
  });
  return membership;
}

async function verifyOrgAdmin(userId: string, organizationId: string) {
  const membership = await verifyOrgMembership(userId, organizationId);
  if (!membership) return null;
  if (membership.role !== "owner" && membership.role !== "admin") return null;
  return membership;
}

async function revalidateWorkspace(organizationId: string) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: { slug: true },
  });
  if (org?.slug) {
    revalidatePath(`/${org.slug}`, "layout");
  }
}

// Create a new category
export async function createCategory(organizationId: string, name: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Only admins can create categories (per CCAT-04)
  const adminMembership = await verifyOrgAdmin(session.user.id, organizationId);
  if (!adminMembership) {
    throw new Error("Only admins can create categories");
  }

  // Get next sort order
  const maxOrderResult = await db
    .select({ maxOrder: max(channelCategories.sortOrder) })
    .from(channelCategories)
    .where(eq(channelCategories.organizationId, organizationId));

  const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

  const [category] = await db.insert(channelCategories).values({
    organizationId,
    name,
    sortOrder: nextOrder,
    createdBy: session.user.id,
  }).returning();

  await revalidateWorkspace(organizationId);
  return category;
}

// Update category (name or sortOrder)
export async function updateCategory(
  categoryId: string,
  data: { name?: string; sortOrder?: number }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get category to verify org admin
  const category = await db.query.channelCategories.findFirst({
    where: eq(channelCategories.id, categoryId),
  });
  if (!category) throw new Error("Category not found");

  const adminMembership = await verifyOrgAdmin(session.user.id, category.organizationId);
  if (!adminMembership) {
    throw new Error("Only admins can update categories");
  }

  await db.update(channelCategories)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(channelCategories.id, categoryId));

  await revalidateWorkspace(category.organizationId);
  return { success: true };
}

// Delete category (channels become uncategorized)
export async function deleteCategory(categoryId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const category = await db.query.channelCategories.findFirst({
    where: eq(channelCategories.id, categoryId),
  });
  if (!category) throw new Error("Category not found");

  const adminMembership = await verifyOrgAdmin(session.user.id, category.organizationId);
  if (!adminMembership) {
    throw new Error("Only admins can delete categories");
  }

  const orgId = category.organizationId;

  // Transaction: set channels to uncategorized, then delete category
  await db.transaction(async (tx) => {
    await tx.update(channels)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(eq(channels.categoryId, categoryId));

    await tx.delete(channelCategories)
      .where(eq(channelCategories.id, categoryId));
  });

  await revalidateWorkspace(orgId);
  return { success: true };
}

// Get categories with channel counts
export async function getCategories(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const membership = await verifyOrgMembership(session.user.id, organizationId);
  if (!membership) {
    throw new Error("Not authorized to view categories");
  }

  const categories = await db.query.channelCategories.findMany({
    where: eq(channelCategories.organizationId, organizationId),
    orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
  });

  // Get channel counts per category
  const channelCounts = await db
    .select({
      categoryId: channels.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(channels)
    .where(
      and(
        eq(channels.organizationId, organizationId),
        eq(channels.isArchived, false)
      )
    )
    .groupBy(channels.categoryId);

  const countMap = new Map(
    channelCounts.map((c) => [c.categoryId, c.count])
  );

  return categories.map((cat) => ({
    ...cat,
    channelCount: countMap.get(cat.id) ?? 0,
  }));
}

// Assign channel to category (admin only per CCAT-04)
export async function assignChannelToCategory(
  channelId: string,
  categoryId: string | null
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Get channel to verify org
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });
  if (!channel) throw new Error("Channel not found");

  const adminMembership = await verifyOrgAdmin(session.user.id, channel.organizationId);
  if (!adminMembership) {
    throw new Error("Only admins can move channels between categories");
  }

  // Verify category belongs to same org (if not null)
  if (categoryId) {
    const category = await db.query.channelCategories.findFirst({
      where: eq(channelCategories.id, categoryId),
    });
    if (!category || category.organizationId !== channel.organizationId) {
      throw new Error("Invalid category");
    }
  }

  await db.update(channels)
    .set({ categoryId, updatedAt: new Date() })
    .where(eq(channels.id, channelId));

  await revalidateWorkspace(channel.organizationId);
  return { success: true };
}

// Reorder categories
export async function reorderCategories(categoryIds: string[]) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  if (categoryIds.length === 0) return { success: true };

  // Get first category to verify org admin
  const firstCategory = await db.query.channelCategories.findFirst({
    where: eq(channelCategories.id, categoryIds[0]),
  });
  if (!firstCategory) throw new Error("Category not found");

  const adminMembership = await verifyOrgAdmin(session.user.id, firstCategory.organizationId);
  if (!adminMembership) {
    throw new Error("Only admins can reorder categories");
  }

  // Update sort order for each category
  await db.transaction(async (tx) => {
    for (let i = 0; i < categoryIds.length; i++) {
      await tx.update(channelCategories)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(channelCategories.id, categoryIds[i]));
    }
  });

  await revalidateWorkspace(firstCategory.organizationId);
  return { success: true };
}

// Reorder channels within a category
export async function reorderChannelsInCategory(
  categoryId: string | null,
  channelIds: string[]
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  if (channelIds.length === 0) return { success: true };

  // Get first channel to verify org admin
  const firstChannel = await db.query.channels.findFirst({
    where: eq(channels.id, channelIds[0]),
  });
  if (!firstChannel) throw new Error("Channel not found");

  const adminMembership = await verifyOrgAdmin(session.user.id, firstChannel.organizationId);
  if (!adminMembership) {
    throw new Error("Only admins can reorder channels");
  }

  // Update sort order for each channel
  await db.transaction(async (tx) => {
    for (let i = 0; i < channelIds.length; i++) {
      await tx.update(channels)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(channels.id, channelIds[i]));
    }
  });

  await revalidateWorkspace(firstChannel.organizationId);
  return { success: true };
}

// Toggle collapse state (any user)
export async function toggleCategoryCollapse(
  categoryId: string,
  isCollapsed: boolean
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  // Verify category exists and user has access
  const category = await db.query.channelCategories.findFirst({
    where: eq(channelCategories.id, categoryId),
  });
  if (!category) throw new Error("Category not found");

  const membership = await verifyOrgMembership(session.user.id, category.organizationId);
  if (!membership) {
    throw new Error("Not authorized to access this category");
  }

  // Upsert collapse state
  await db
    .insert(userCategoryCollapseStates)
    .values({
      userId: session.user.id,
      categoryId,
      isCollapsed,
    })
    .onConflictDoUpdate({
      target: [userCategoryCollapseStates.userId, userCategoryCollapseStates.categoryId],
      set: {
        isCollapsed,
        updatedAt: new Date(),
      },
    });

  // No revalidatePath needed - this is client state
  return { success: true };
}

// Get user's collapse states for all categories in org
export async function getCollapseStates(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const membership = await verifyOrgMembership(session.user.id, organizationId);
  if (!membership) {
    throw new Error("Not authorized to view this organization");
  }

  // Get all category IDs for this org
  const orgCategories = await db.query.channelCategories.findMany({
    where: eq(channelCategories.organizationId, organizationId),
    columns: { id: true },
  });

  if (orgCategories.length === 0) return {};

  const categoryIds = orgCategories.map((c) => c.id);

  // Get user's collapse states
  const states = await db.query.userCategoryCollapseStates.findMany({
    where: and(
      eq(userCategoryCollapseStates.userId, session.user.id),
      inArray(userCategoryCollapseStates.categoryId, categoryIds)
    ),
  });

  // Return as map of categoryId -> isCollapsed
  const stateMap: Record<string, boolean> = {};
  for (const state of states) {
    stateMap[state.categoryId] = state.isCollapsed;
  }
  return stateMap;
}

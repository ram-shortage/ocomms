/**
 * Sidebar preferences data structure.
 *
 * This is the canonical type for sidebar preferences stored in the database
 * and used by the sidebar preferences hook.
 */
export interface SidebarPreferencesData {
  categoryOrder: string[];      // Category IDs in user's preferred order
  dmOrder: string[];            // DM conversation IDs in order
  sectionOrder: string[];       // Section IDs: 'threads', 'search', 'notes', 'scheduled', 'reminders', 'saved'
  hiddenSections: string[];     // Section IDs user has hidden
  collapsedSections: string[];  // Section IDs user has collapsed (different from hidden)
  updatedAt: string;            // ISO timestamp for conflict resolution
}

/**
 * Default section order for new users or when preferences are not set.
 */
export const DEFAULT_SECTION_ORDER = ['threads', 'search', 'notes', 'scheduled', 'reminders', 'saved'];

/**
 * Empty preferences object for initialization.
 */
export const EMPTY_SIDEBAR_PREFERENCES: SidebarPreferencesData = {
  categoryOrder: [],
  dmOrder: [],
  sectionOrder: DEFAULT_SECTION_ORDER,
  hiddenSections: [],
  collapsedSections: [],
  updatedAt: new Date().toISOString(),
};

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
  mainSectionOrder: string[];   // Main section IDs: 'channels', 'dms', 'archived' - order of main sections
  updatedAt: string;            // ISO timestamp for conflict resolution
}

/**
 * Default order for main sidebar sections (Channels, DMs, Archived).
 */
export const DEFAULT_MAIN_SECTION_ORDER = ['channels', 'dms', 'archived'];

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
  mainSectionOrder: DEFAULT_MAIN_SECTION_ORDER,
  updatedAt: new Date().toISOString(),
};

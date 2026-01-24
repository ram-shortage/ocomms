# Browser Testing Observations - OComms Chat Application

**Test Date:** January 22, 2026
**Test URL:** https://chat.ocomms.org
**Workspace Tested:** Cardboard Box Conglomerate

---

## Critical Issues

### 1. DMs Route Returns 404 Error
- **Severity:** Critical
- **Location:** `/cardboard-box-conglomerate/dm`
- **Description:** Clicking on the "DMs" link in the bottom navigation bar (mobile) or navigating to the `/dm` route directly results in a 404 "This page could not be found" error.
- **Impact:** Users cannot access Direct Messages functionality, which is a core feature prominently displayed in the navigation.
- **Reproduction:** Click on "DMs" in the bottom navigation bar on mobile, or navigate directly to the `/dm` route.

---

## UI/Layout Issues

### 2. Profile Page Title Concatenation Issue
- **Severity:** Medium
- **Location:** Profile page (`/cardboard-box-conglomerate/profile`)
- **Platforms:** Desktop and Mobile
- **Description:** The page title "Your Profile" and the "Back to workspace" link appear concatenated without proper spacing, displaying as "Your ProfileBack to workspace".
- **Expected:** There should be spacing or visual separation between the title and the back link.

### 3. Mobile Channel Header Crowding
- **Severity:** Medium
- **Location:** Channel view on mobile (`/cardboard-box-conglomerate/channels/business-updates`)
- **Description:** The channel header is cluttered with icons overlapping and text appearing cut off. The "Add a topic" text is truncated, and action icons are cramped together making them difficult to tap.
- **Recommendation:** Consider using a collapsible menu or overflow menu for channel actions on mobile.

### 4. Workspace Name Truncation in Sidebar
- **Severity:** Low
- **Location:** Desktop sidebar header
- **Description:** The workspace name "Cardboard Box Conglomerate" is truncated to "Cardboard Box Congl..." in the sidebar header.
- **Recommendation:** Consider using a tooltip on hover to display the full name, or allow the sidebar to expand to accommodate longer names.

---

## Navigation Issues

### 5. Mobile Navigation State Bug
- **Severity:** Medium
- **Location:** Mobile bottom navigation bar
- **Description:** The navigation state highlighting is inconsistent. After visiting the DMs page (which 404s), the DMs icon remains highlighted even when navigating to other pages like Profile, Channel view, or Settings. The correct navigation item should be highlighted based on the current page.
- **Affected Pages:** Profile, Channel views, Settings (all incorrectly show DMs as highlighted after visiting the 404 page)
- **Note:** Some pages like Search and Mentions correctly update the navigation state.

---

## Functional Observations (Working Correctly)

### Desktop Features Tested:
- **Home/Welcome page:** Displays correctly with sidebar and main content
- **Channel view:** Message area, input field, and toolbar work correctly
- **Threads page:** Displays empty state message correctly
- **Search page:** Search input and empty state display correctly
- **My Notes:** Personal scratchpad with edit functionality
- **Scheduled Messages:** Empty state displays correctly
- **Reminders:** Empty state displays correctly
- **Saved Items:** Empty state displays correctly
- **Settings:** All settings categories display correctly (Members, Guest Management, User Groups, Custom Emoji, Analytics, Audit Logs)
- **Analytics page:** Charts and time filters display correctly, showing "No data for this period"
- **Members page:** Invite form and member list display correctly
- **Channel Directory:** Browse all channels page displays correctly
- **Theme toggle:** Light/dark mode switching works correctly
- **Create Channel dialog:** Modal displays correctly with all form fields
- **Set Status popover:** Quick presets, custom status, and duration options work correctly

### Mobile Features Tested:
- **Responsive layout:** Sidebar hidden, bottom navigation visible
- **Channel Directory:** Displays correctly on mobile
- **Search page:** Displays correctly with proper navigation state
- **Settings page:** Stacks vertically and displays correctly
- **Threads/Mentions page:** Displays correctly with proper navigation state
- **Profile page:** Form displays correctly (aside from title concatenation issue)

---

## PWA Observations

- The application appears to be designed with mobile-first PWA considerations
- Bottom navigation bar is visible on mobile viewport
- Touch targets appear adequately sized (except for the crowded channel header)
- The application responds to viewport changes appropriately

---

## Recommendations

### High Priority:
1. **Fix the DMs route** - This is a critical navigation element that leads to a 404. Either implement the DM functionality or temporarily remove/disable the link.

### Medium Priority:
2. **Fix Profile page title layout** - Add proper spacing between the title and back link
3. **Fix mobile navigation state management** - Ensure the correct navigation item is highlighted based on current route
4. **Improve mobile channel header** - Use an overflow menu or redesign to prevent crowding

### Low Priority:
5. **Add tooltip for truncated workspace name** - Improve UX for long workspace names

---

## Test Environment

- **Browser:** Chrome (via Claude in Chrome extension)
- **Desktop Viewport:** 972x885
- **Mobile Viewport:** 390x844 (simulated iPhone dimensions)
- **Theme:** Tested in both light and dark modes
- **User:** Dee@ocomms.org (Owner role)

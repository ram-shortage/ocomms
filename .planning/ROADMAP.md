# Roadmap: OComms v0.4.0

## Overview

v0.4.0 delivers three feature areas: dark mode theming for improved accessibility and user preference, file uploads for sharing documents and images in conversations, and markdown notes for persistent knowledge sharing in channels and personal scratchpads. Theming comes first (affects all UI), file uploads second (extends proven avatar pattern), and notes last (most new surface area).

## Milestones

- v0.1.0 MVP - Phases 1-8 (shipped 2026-01-18)
- v0.2.0 Security Hardening - Phases 9-13 (shipped 2026-01-18)
- v0.3.0 Mobile & Polish - Phases 14-20 (shipped 2026-01-19)
- **v0.4.0 Files, Theming & Notes** - Phases 21-23 (in progress)

## Phases

- [ ] **Phase 21: Dark Mode/Theming** - Light/dark theme toggle with system preference and FOUC prevention
- [ ] **Phase 22: File Uploads** - Drag-drop file attachments up to 25MB with inline image previews
- [ ] **Phase 23: Notes** - Markdown notes per channel and personal scratchpads with conflict detection

## Phase Details

### Phase 21: Dark Mode/Theming
**Goal**: Users can choose between light and dark themes with their preference persisted across sessions
**Depends on**: Nothing (standalone, affects all UI)
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04, THEME-05
**Success Criteria** (what must be TRUE):
  1. User can toggle between light and dark mode from the UI
  2. Theme defaults to system preference on first visit
  3. User's theme choice persists across browser sessions
  4. Page loads without flash of wrong theme (no FOUC)
  5. All existing UI components render correctly in both themes
**Plans**: 2 plans

Plans:
- [ ] 21-01-PLAN.md - Install next-themes, create ThemeProvider, add toggle to sidebar
- [ ] 21-02-PLAN.md - Audit and fix hardcoded colors, verify all UI in both themes

### Phase 22: File Uploads
**Goal**: Users can attach files to messages in channels and DMs with visual previews for images
**Depends on**: Phase 21 (file preview components need theming)
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06, FILE-07, FILE-08, FILE-09, FILE-10
**Success Criteria** (what must be TRUE):
  1. User can drag-and-drop or click to upload files up to 25MB
  2. User sees upload progress indicator while file uploads
  3. Image files display as inline previews in messages
  4. Non-image files display as download links with filename and size
  5. Files over 25MB are rejected with clear error message
**Plans**: TBD

Plans:
- [ ] 22-01: TBD

### Phase 23: Notes
**Goal**: Users can create and edit markdown notes per channel and maintain a personal scratchpad
**Depends on**: Phase 21 (notes UI needs theming), Phase 22 (optional future attachment support)
**Requirements**: NOTE-01, NOTE-02, NOTE-03, NOTE-04, NOTE-05, NOTE-06, NOTE-07
**Success Criteria** (what must be TRUE):
  1. Each channel has a shared markdown document accessible from channel header
  2. Each user has a personal notes scratchpad in each workspace
  3. User can edit notes with markdown syntax and preview rendered output
  4. Any channel member can edit that channel's notes
  5. Concurrent edits trigger conflict detection with user warning
**Plans**: TBD

Plans:
- [ ] 23-01: TBD

## Progress

**Execution Order:** 21 -> 22 -> 23

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 21. Dark Mode/Theming | v0.4.0 | 0/2 | Planned | - |
| 22. File Uploads | v0.4.0 | 0/TBD | Not started | - |
| 23. Notes | v0.4.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-20*
*Milestone: v0.4.0 Files, Theming & Notes*

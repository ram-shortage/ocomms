# Requirements: OComms v0.4.0

**Defined:** 2026-01-20
**Core Value:** Data sovereignty - complete control over communication data

## v0.4.0 Requirements

Requirements for Files, Theming & Notes release. Each maps to roadmap phases.

### File Uploads

- [ ] **FILE-01**: User can drag-and-drop files onto message input to upload
- [ ] **FILE-02**: User can click upload button to browse and select files
- [ ] **FILE-03**: User sees progress indicator during file upload
- [ ] **FILE-04**: Image files display inline preview in messages (jpg, png, gif, webp)
- [ ] **FILE-05**: Non-image files display as download link with filename and size
- [ ] **FILE-06**: Files over 25MB are rejected with clear error message
- [ ] **FILE-07**: File content is validated via magic bytes (not just extension)
- [ ] **FILE-08**: User can attach files to messages in channels
- [ ] **FILE-09**: User can attach files to messages in DMs
- [ ] **FILE-10**: User can paste image from clipboard to upload

### Dark Mode

- [ ] **THEME-01**: User can toggle between light and dark mode via UI control
- [ ] **THEME-02**: Theme defaults to system preference (prefers-color-scheme)
- [ ] **THEME-03**: User's theme choice persists across sessions
- [ ] **THEME-04**: No flash of wrong theme on initial page load (FOUC prevention)
- [ ] **THEME-05**: All UI components render correctly in both light and dark themes

### Notes

- [ ] **NOTE-01**: Each channel has one shared markdown document
- [ ] **NOTE-02**: Each user has a personal notes scratchpad (per workspace)
- [ ] **NOTE-03**: User can edit notes using markdown syntax
- [ ] **NOTE-04**: User can preview rendered markdown while editing
- [ ] **NOTE-05**: Any member of a channel can edit that channel's notes
- [ ] **NOTE-06**: Concurrent edits trigger conflict detection with warning
- [ ] **NOTE-07**: User can access channel notes from channel header button

## v0.5.0 Requirements (Deferred)

Acknowledged for future release. Not in current roadmap.

### API Platform

- **API-01**: REST API for external access to OComms data
- **API-02**: API authentication via tokens
- **API-03**: Rate limiting on API endpoints

### Webhooks

- **HOOK-01**: Incoming webhooks (external systems post to channels)
- **HOOK-02**: Outgoing webhooks (OComms notifies external systems)
- **HOOK-03**: Webhook configuration UI

### Bots

- **BOT-01**: Bot user account type
- **BOT-02**: Bots can read messages in channels they're added to
- **BOT-03**: Bots can post messages to channels
- **BOT-04**: Bot management UI

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| S3/cloud storage | Local disk maintains self-hosted simplicity |
| File versioning | Complexity without clear value for chat files |
| Real-time collaborative editing | CRDT/OT complexity; last-write-wins sufficient |
| Note comments/threads | Notes are simple docs, not discussion threads |
| Theme customization | Light/dark sufficient; custom themes add complexity |
| File search | Full-text search of file contents is separate feature |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | Phase 21 | Pending |
| THEME-02 | Phase 21 | Pending |
| THEME-03 | Phase 21 | Pending |
| THEME-04 | Phase 21 | Pending |
| THEME-05 | Phase 21 | Pending |
| FILE-01 | Phase 22 | Pending |
| FILE-02 | Phase 22 | Pending |
| FILE-03 | Phase 22 | Pending |
| FILE-04 | Phase 22 | Pending |
| FILE-05 | Phase 22 | Pending |
| FILE-06 | Phase 22 | Pending |
| FILE-07 | Phase 22 | Pending |
| FILE-08 | Phase 22 | Pending |
| FILE-09 | Phase 22 | Pending |
| FILE-10 | Phase 22 | Pending |
| NOTE-01 | Phase 23 | Pending |
| NOTE-02 | Phase 23 | Pending |
| NOTE-03 | Phase 23 | Pending |
| NOTE-04 | Phase 23 | Pending |
| NOTE-05 | Phase 23 | Pending |
| NOTE-06 | Phase 23 | Pending |
| NOTE-07 | Phase 23 | Pending |

**Coverage:**
- v0.4.0 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-01-20 after roadmap creation*

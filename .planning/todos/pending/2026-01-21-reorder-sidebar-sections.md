---
created: 2026-01-21T18:15
title: Reorder sidebar sections - move features below conversations
area: ui
files:
  - src/components/workspace/workspace-sidebar.tsx
---

## Problem

The sidebar currently has Notes, Scheduled Messages, Reminders, and Saved Items positioned in a way that doesn't match the expected UX hierarchy. These secondary features should appear below the primary navigation items (Channels and DMs).

Current order may be:
- Notes/Scheduled/Reminders/Saved at top or middle
- Channels
- DMs

Expected order:
- Channels
- DMs
- Notes
- Scheduled Messages
- Reminders
- Saved Items

## Solution

Reorder the JSX in workspace-sidebar.tsx to place Channels and DMs sections first, followed by the feature sections (Notes, Scheduled, Reminders, Saved).

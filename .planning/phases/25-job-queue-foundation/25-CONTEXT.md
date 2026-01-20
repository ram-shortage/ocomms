# Phase 25: Job Queue Foundation - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

BullMQ infrastructure enabling scheduled message delivery and message reminders with persistent job processing that survives server restarts. Users can schedule messages for future delivery, set reminders on messages, and manage pending items. Includes recurring reminders (daily, weekly).

</domain>

<decisions>
## Implementation Decisions

### Scheduling UI
- Access via Send button dropdown (click arrow next to Send to reveal "Schedule send" option, like Gmail)
- Quick-pick presets: Tomorrow 9am, Monday 9am, Custom date/time picker
- Timezone handling: Implicit (user's detected timezone), display times without zone indicator
- Date/time picker: Native browser datetime-local input for custom scheduling

### Reminder Experience
- Set reminders via message action menu ("Remind me..." option in message's ⋮ menu)
- Reminder time presets: Same as scheduling (Tomorrow 9am, Monday 9am, Custom) for consistency
- Snooze options: Fixed intervals (20 min, 1 hour, 3 hours, Tomorrow) as quick taps
- Recurring reminders included (daily, weekly repeat option when setting reminder per RMND-07)

### Pending Item Management
- Access location: Sidebar section with "Scheduled" and "Reminders" as separate sidebar items (like Saved Messages)
- Scheduled messages list: Full preview showing complete message content with scheduled time and destination channel
- Scheduled message actions: Edit, Cancel, Send now (full control)
- Reminders list: Note-style display showing reminder note (if any) with link to jump to original message

### Notification Delivery
- Delivery method: Both in-app toast AND push notification for reminders
- Click action: Opens reminder detail view (with snooze/complete options), then option to jump to message
- Scheduled message sends: No notification to sender (message just appears in channel at scheduled time)
- Reminder detail view: Slide-in panel from right (like thread view) with actions

### Claude's Discretion
- BullMQ configuration and job processing patterns
- Database schema for scheduled messages and reminders
- Error handling for failed job deliveries
- Exact styling of scheduling dropdown and reminder panels

</decisions>

<specifics>
## Specific Ideas

- Schedule dropdown should feel like Gmail's "Schedule send" — familiar pattern
- Reminder panel slides in like thread view does — consistent with existing app patterns
- Quick-pick presets deliberately minimal (2 presets + custom) to avoid choice paralysis

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-job-queue-foundation*
*Context gathered: 2026-01-20*

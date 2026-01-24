# OComms Feature Reference Guide

A comprehensive reference for all OComms features. Use this guide to understand what the application can do and how to use each feature.

---

## Table of Contents

1. [Messaging & Communication](#messaging--communication)
2. [Organization & Discovery](#organization--discovery)
3. [Attention Management](#attention-management)
4. [Scheduling & Productivity](#scheduling--productivity)
5. [Rich Content & Files](#rich-content--files)
6. [Presence & Awareness](#presence--awareness)
7. [Mobile & PWA](#mobile--pwa)
8. [Access Control](#access-control)
9. [Administration & Analytics](#administration--analytics)
10. [Security](#security)
11. [Customization](#customization)
12. [User & Workspace Management](#user--workspace-management)
13. [Limits & Configuration Reference](#limits--configuration-reference)

---

## Messaging & Communication

### Real-Time Messaging

Send and receive messages instantly across channels and direct messages using WebSocket connections.

**How to use:**
- Type your message in the input box at the bottom of a channel or DM
- Press Enter to send
- Messages appear immediately for all participants

**Limits:**
- Maximum message length: 10,000 characters
- Rate limit: 10 messages per 60 seconds per user

---

### Channels (Public & Private)

Create organized spaces for team conversations by topic.

**How to use:**
- Click "Create Channel" in the sidebar or via Settings > Channels
- Set channel name, description, and privacy level
- For private channels, members require invitation or admin approval

**Configuration options:**
- Channel name and URL-friendly slug
- Description and topic
- Privacy setting (public/private)
- Channel archiving (makes channel read-only)

**Notes:**
- Channel slugs must be unique within workspace
- Archived channels cannot receive new messages
- Only members can see private channels

---

### Channel Membership & Roles

Manage who can access channels and grant admin permissions.

**How to use:**
- Channel Settings > Members to invite or remove members
- Click a member to change their role (member/admin)
- Channel admins can manage notes, invitations, and settings

**Roles:**
- **Member:** Can read and post messages
- **Admin:** Can manage channel settings, notes, and members

---

### Direct Messages (1:1 & Group)

Private conversations outside of channels.

**How to use:**
- Click "Start DM" in the sidebar
- Search and select one or more users
- Messages appear in the DM section with unread badges

**Notes:**
- Group DMs can optionally be named
- Guests cannot participate in DMs

---

### Message Threading

Reply to specific messages to keep conversations organized.

**How to use:**
- Hover over a message and click "Reply in thread"
- A thread panel opens on the right (desktop) or as a sheet (mobile)
- Reply count shows on the parent message

**Notes:**
- Threads available in channels and group DMs
- Threads auto-expand when you have unread replies

---

### Message Reactions

React to messages with standard or custom emoji.

**How to use:**
- Hover over a message and click the reaction icon
- Select an emoji from the picker
- Click the same emoji again to remove your reaction

**Custom emoji:**
- Workspace admins can upload custom emoji (PNG, JPG, GIF)
- Maximum size: 128KB, output: 128x128px
- Use `:shortcode:` syntax in messages

---

### Typing Indicators

See when others are composing messages.

**How it works:**
- Shows "[Name] is typing..." when someone is typing
- Automatically triggered when you start typing
- Clears when the user stops typing or disconnects

---

### Message Search

Find messages across all accessible conversations.

**How to use:**
- Click the search icon in the sidebar or use the keyboard shortcut
- Type your query (supports multi-word search)
- Results ranked by relevance
- Click a result to jump to that message

**Notes:**
- Results limited to 50 per query
- Only searches messages you have access to
- Deleted messages are excluded

---

### Message Deletion

Remove messages you've sent.

**How to use:**
- Hover over your own message and click the delete option
- Message is removed from view
- Thread integrity and reply counts are preserved

**Notes:**
- Only the message author can delete their messages
- Deletion is soft (preserves thread structure)

---

## Organization & Discovery

### Workspaces (Multi-Tenancy)

Separate spaces for different teams or organizations with complete data isolation.

**How to use:**
- Your first workspace is created automatically on signup
- Create additional workspaces from the workspace menu
- Switch between workspaces via the dropdown in the header

**Configuration:**
- Workspace name and slug
- Logo and description
- Join policy: invite_only, request, or open

---

### Workspace Switcher

Quickly navigate between your workspaces.

**How to use:**
- Click the workspace avatar/name in the header
- Dropdown shows all your workspaces with unread counts
- Click to switch

---

### Browse & Join Workspaces

Discover and join available workspaces.

**How to use:**
- Click "Browse Workspaces" from the workspace menu
- View public and request-enabled workspaces
- Click "Join" (instant) or "Request" (requires approval)

**Join policies:**
- **invite_only:** Hidden, invitation required
- **request:** Visible, requires admin approval
- **open:** Visible, instant join

---

### Channel Categories

Group related channels into collapsible sections.

**How to use:**
- Settings > Sidebar Settings to create and manage categories
- Drag channels into categories
- Click category headers to collapse/expand

---

### Sidebar Drag-and-Drop

Reorder channels, categories, and DMs to your preference.

**How to use:**
- Drag category, channel, or DM headers to reorder
- Order saves automatically
- Preferences sync across your devices

**Notes:**
- Each user has their own sidebar order
- Section order: Channels, DMs, Archived

---

### Sidebar Sections

Show, hide, or collapse main sidebar sections.

**Sections:**
- **Main:** Channels, DMs, Archived
- **Utility:** Threads, Search, Notes, Scheduled, Reminders, Saved

**How to use:**
- Click section headers to collapse
- Settings > Sidebar to permanently hide sections

---

### Channel Archiving

Mark channels as read-only while preserving history.

**How to use:**
- Channel Settings > Archive Channel
- Channel moves to the Archived section
- Members can view history but cannot post

---

### Member Profiles

View team member information.

**How to use:**
- Click any username to view their profile
- Shows name, email, avatar, and custom status

**Avatar uploads:**
- Supported formats: JPEG, PNG, GIF, WebP
- Maximum size: 25MB
- SVG files are blocked for security

---

## Attention Management

### @user Mentions

Notify specific users in a message.

**How to use:**
- Type "@" in the message input
- Select a user from the autocomplete list
- The mentioned user receives a notification

---

### @channel Mentions

Notify all channel members.

**How to use:**
- Type "@channel" in a channel message
- All members receive a notification (respects mute settings)

**Note:** Only works in channels, not DMs.

---

### @here Mentions

Notify only currently active members.

**How to use:**
- Type "@here" in a channel message
- Only users with "active" presence receive a notification

---

### User Groups

Create reusable groups for team mentions.

**How to use:**
- Settings > User Groups to create a group
- Add members to the group
- Use "@grouphandle" in messages to mention all members

**Example:** Create "@designers" to mention the entire design team.

---

### Per-Channel Notification Settings

Control notification level for each channel.

**How to use:**
- Channel Settings > Notification Mode
- Choose: All, Mentions, or Muted

**Modes:**
- **All:** All messages trigger notifications (default)
- **Mentions:** Only @user or @group mentions notify you
- **Muted:** No notifications from this channel

---

### Unread Counts & Mark-as-Read

Track unread messages across conversations.

**How it works:**
- Red badges show unread counts on channels and DMs
- Opening a channel automatically marks messages as read
- Unread counts appear in the workspace switcher

---

### Push Notifications

Receive browser notifications for mentions.

**How to use:**
- Grant browser permission when prompted
- Notifications appear in your system notification center

**Requirements:**
- Web Push VAPID keys configured (admin)
- Browser permission granted
- Not in Do Not Disturb mode

---

### Reminders

Set reminders on messages to resurface them later.

**How to use:**
- Hover over a message and select "Set Reminder"
- Choose: 20 minutes, 1 hour, 3 hours, tomorrow, or custom time
- Reminder fires at the scheduled time
- Snooze options available when reminder triggers

**Features:**
- Optional recurring patterns (daily, weekly)
- Attach notes to reminders
- View all reminders in the "Reminders" section

---

### Bookmarks

Save important messages or files for quick access.

**How to use:**
- Hover over a message or file and click the bookmark icon
- Optionally add a note
- Access bookmarks in the "Saved" section

---

## Scheduling & Productivity

### Scheduled Messages

Compose messages now, send them later.

**How to use:**
- Type your message and click "Schedule"
- Select date and time
- View pending messages in the "Scheduled" section
- Edit or cancel before the send time

**Status tracking:** pending, processing, sent, cancelled, failed

---

### Custom User Status

Set a status with emoji and optional expiration.

**How to use:**
- Click your avatar > "Set Status"
- Choose an emoji and enter status text (max 100 characters)
- Optionally set an expiration time for auto-clear

**Example:** "In a meeting" with a 1-hour expiration

---

### Channel Notes

Shared markdown notes for a channel.

**How to use:**
- Click the channel header > "Notes"
- Edit markdown content
- Changes sync to all channel members

**Use cases:** Meeting agendas, guidelines, reference docs

---

### Personal Notes

Private markdown notes per workspace.

**How to use:**
- Click "Notes" in the sidebar
- Create and edit private notes
- Notes are never shared with others

---

## Rich Content & Files

### Link Previews

Automatic preview cards for URLs.

**How it works:**
- Paste a URL in your message
- Preview card appears with title, description, and image
- Click to open the link
- Hover to dismiss the preview

**Notes:**
- Previews cached for 24 hours
- SSRF protection for secure fetching

---

### File Uploads

Attach files to messages.

**How to use:**
- Click the attachment icon in the message input
- Or drag-drop files into the compose area
- Or paste from clipboard

**Supported formats:** JPEG, PNG, GIF, WebP, PDF

**Limits:**
- Maximum file size: 25MB
- Per-user storage quota: 1GB (warning at 80%)
- SVG files blocked for security

---

### Custom Emoji

Upload workspace-specific emoji.

**How to use:**
- Settings > Emoji > "Upload Emoji"
- Select file (auto-resized to 128x128)
- Set a shortcode
- Use `:shortcode:` in messages or reactions

**Limits:**
- Maximum size: 128KB
- Formats: PNG, JPG, GIF (animated supported)
- Unique shortcode per workspace

---

## Presence & Awareness

### Online Status Indicators

See who's active in your workspace.

**Status indicators:**
- **Green dot:** Active, recently sent a message
- **Yellow dot:** Away, online but inactive
- **Gray dot:** Offline

**Technical details:**
- Heartbeat interval: 30 seconds
- Presence TTL: 60 seconds

---

### Do Not Disturb Mode

Suppress notifications while allowing direct mentions.

**How to use:**
- Set status > toggle DND mode
- Shows "Do Not Disturb" indicator
- @user mentions still notify you

---

## Mobile & PWA

### Progressive Web App

Install OComms as an app on mobile or desktop.

**How to install:**
- **Mobile:** Accept the "Add to Home Screen" prompt
- **Desktop:** Click the install icon in the browser
- **iOS:** Use Share > Add to Home Screen

---

### Offline Support

Read messages and queue sends while offline.

**Features:**
- Messages cached for 7 days in local storage
- Compose messages offline; they send when reconnected
- Exponential backoff retry on failure (up to 5 attempts)

---

### Mobile Layout

Touch-optimized interface with bottom navigation.

**Navigation:**
- Bottom bar shows: Channels, DMs, Search, More
- "More" menu contains: Scheduled, Reminders, Saved, Notes, Status

---

## Access Control

### Guest Accounts

Limited-access accounts for external collaborators.

**How to create (admin):**
- Settings > Guests
- Create invite link with specific channel access
- Optionally set expiration date

**Guest limitations:**
- Access only to specified channels
- Cannot access DMs
- Cannot create new channels
- "Guest" badge shown on profile and messages

---

## Administration & Analytics

### Analytics Dashboard

View workspace metrics (admin only).

**Available metrics:**
- **Message Volume:** Daily message count over time
- **Active Users:** DAU, WAU, MAU with trend indicators
- **Channel Activity:** Messages per channel
- **Storage Usage:** Total file storage used

**How to access:**
- Settings > Admin (admin/owner only)
- Select date range (default: last 30 days)
- Export data to CSV

---

### Audit Logs

Security audit trail for compliance.

**Logged events:**
- Logins and logouts
- Data exports
- Admin actions

**Features:**
- HMAC-signed for tamper detection
- Filter by event type or user
- Includes IP address and user agent

---

### GDPR Data Export

Export all workspace data for compliance.

**How to use (owner only):**
- Settings > Admin > "Export Data"
- Downloads ZIP with JSON files
- Includes: members, channels, messages, files, reactions

---

## Security

### Two-Factor Authentication

Optional MFA using TOTP.

**How to set up:**
- Settings > Profile > Security > Setup MFA
- Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
- Enter verification code
- Download backup codes for recovery

**Notes:**
- 6-digit codes, 30-second window
- 10 single-use backup codes

---

### Security Features

Built-in protections:

- **Password breach detection:** Checks against known-breached database
- **Password history:** Prevents reusing old passwords
- **CSP with nonce:** Prevents XSS attacks
- **SVG blocking:** Prevents script injection via uploads
- **Rate limiting:** 10 messages per 60 seconds per user
- **Unicode sanitization:** Removes dangerous control characters
- **SSRF protection:** Secure link preview fetching
- **Subresource Integrity:** Verifies script/CSS integrity
- **Secure cookies:** HttpOnly, Secure, SameSite=Strict in production
- **Redirect validation:** Prevents open redirect attacks

---

## Customization

### Dark Mode

Switch between light and dark themes.

**How to use:**
- Settings > Appearance > Theme toggle
- Or: System preference auto-detection
- Preference persists across sessions

---

## User & Workspace Management

### User Invitations

Invite new users to your workspace.

**How to use:**
- Settings > Members > Invite Members
- Enter email addresses
- Invitation link sent via email

---

### Profile Management

Edit your account details.

**Settings available:**
- Name and avatar
- Email address
- Password
- MFA setup

---

### Session Management

View and manage active sessions.

**How to use:**
- Settings > Profile > Sessions
- View IP, device, and last activity
- Click "Revoke" to logout a specific session

---

### Workspace Settings (Admin)

Configure workspace details.

**Settings available:**
- Workspace name and slug
- Logo image
- Description
- Join policy

---

### Member Management (Admin)

Manage team membership.

**How to use:**
- Settings > Members
- View all members with roles
- Remove members or change roles
- Invite new members

**Roles:**
- **Member:** Standard access
- **Admin:** Can manage members and settings
- **Owner:** Full control including data export

---

## Limits & Configuration Reference

### Message Limits
| Setting | Value |
|---------|-------|
| Max message length | 10,000 characters |
| Rate limit | 10 messages / 60 seconds / user |

### File Limits
| Setting | Value |
|---------|-------|
| Max file size | 25MB |
| Max emoji size | 128KB |
| Supported formats | JPEG, PNG, GIF, WebP, PDF |
| Blocked formats | SVG |

### Storage Limits
| Setting | Value |
|---------|-------|
| Default user quota | 1GB |
| Warning threshold | 80% usage |

### Search Limits
| Setting | Value |
|---------|-------|
| Max results | 50 per query |

### Presence
| Setting | Value |
|---------|-------|
| Heartbeat interval | 30 seconds |
| Presence TTL | 60 seconds |

### Notification Modes
| Mode | Behavior |
|------|----------|
| All | All messages trigger notifications |
| Mentions | Only @user/@group mentions |
| Muted | No notifications |

---

*Last updated: 2026-01-24*

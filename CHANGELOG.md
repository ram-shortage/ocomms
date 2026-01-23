# Changelog

All notable changes to OComms will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-01-23

### Security
- CSP nonce-based script loading, removed unsafe-inline (SEC2-01)
- Server-side session validation with immediate revocation (SEC2-02)
- SVG upload blocking with content detection (SEC2-03)
- Socket.IO rate limiting for all handlers (SEC2-04)
- Unicode control character sanitization (SEC2-05)
- Channel membership verification for notes API (SEC2-06)
- HMAC-signed audit logs (SEC2-07)
- Secure data export authorization (SEC2-08)
- Password breach detection via bloom filter (SEC2-09)
- Per-user storage quota tracking (SEC2-10)
- Secure cookie prefix in production (SEC2-11)
- Structured logging with Pino (SEC2-12)
- Socket.IO CORS whitelist (SEC2-13)
- Redirect URL validation (SEC2-14)
- SSRF DNS rebinding protection (SEC2-15)
- Soft-locked guest disconnection (SEC2-16)
- Subresource Integrity for static assets (SEC2-17)
- Direct security headers on API routes (SEC2-18)
- Sanitized error messages (SEC2-19)
- Password history enforcement (SEC2-20)
- TOTP MFA with backup codes (SEC2-21)
- Orphaned attachment cleanup job (SEC2-22)

### Added
- Workspace switcher with unread counts (WKSP2-01, WKSP2-02, WKSP2-06)
- Browse and join available workspaces (WKSP2-03)
- Join request approval workflow (WKSP2-04, WKSP2-05)
- Sidebar drag-and-drop category reordering (SIDE-02)
- Sidebar drag-and-drop channel reordering (SIDE-03)
- Cross-category channel movement (SIDE-04)
- DM conversation reordering (SIDE-05)
- Sidebar section reordering (SIDE-06)
- Per-user sidebar preferences with cross-device sync (SIDE-07, SIDE-08)
- Mobile More menu for Scheduled/Reminders/Saved (MOBI2-01, MOBI2-02, MOBI2-03)
- Mobile user status control (MOBI2-04)
- Mobile-optimized emoji picker (MOBI2-05)
- Mobile workspace analytics (MOBI2-08)
- E2E test infrastructure with Docker Compose test environment
- Playwright test suite with multiple browser configurations

### Fixed
- DMs route 404 on mobile (FIX-01)
- Profile page spacing (FIX-02)
- Mobile channel header overflow (FIX-03)
- Workspace name tooltip on hover (FIX-04)
- Mobile navigation route highlighting (FIX-05)

### Changed
- New Category button moved to Settings page (SIDE-01)
- Mobile touch targets now minimum 44px (MOBI2-09)

## [0.5.0] - 2026-01-21

### Added
- Scheduled messages with timezone support
- Message reminders (snooze, recurring)
- Message bookmarks (saved items)
- Custom user status with emoji and expiration
- Link previews with Open Graph unfurling
- Custom emoji upload per workspace
- User groups for @mentions
- Guest accounts with channel-scoped access
- Guest expiration dates
- Workspace analytics dashboard
- CSV export for analytics data

### Changed
- Enhanced notification settings
- Improved search performance

## [0.4.0] - 2026-01-20

### Added
- Dark mode theme support
- File uploads up to 25MB with drag-drop and clipboard paste
- Image inline previews and download cards
- Channel notes (shared markdown per channel)
- Personal notes (private scratchpad)

### Changed
- Improved attachment handling
- Better mobile file upload experience

## [0.3.0] - 2026-01-19

### Added
- Progressive Web App (PWA) with install prompt
- Offline message reading (7-day cache)
- Offline send queue with automatic sync
- Push notifications (Web Push API)
- Responsive mobile layout with bottom navigation

### Changed
- Improved mobile experience
- Better offline support

## [0.2.0] - 2026-01-18

### Added
- HTTPS with Let's Encrypt certificates
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting for API endpoints
- Audit logging for sensitive operations

### Changed
- Enhanced authentication flow
- Improved session management

## [0.1.0] - 2026-01-18

### Added
- Real-time messaging via WebSockets
- Channels (public and private) with membership management
- Direct messages (1:1 and group conversations)
- Message threading with dedicated thread panel
- Emoji reactions with custom emoji support
- Typing indicators
- Full-text search across all accessible messages
- @user, @channel, @here mentions
- Per-channel notification settings
- Unread counts and mark-as-read
- Member profiles with avatars
- Workspaces with tenant isolation
- Channel categories with collapsible sections
- Channel archiving

---

[0.6.0]: https://github.com/ram-shortage/ocomms/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ram-shortage/ocomms/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ram-shortage/ocomms/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ram-shortage/ocomms/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ram-shortage/ocomms/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ram-shortage/ocomms/releases/tag/v0.1.0

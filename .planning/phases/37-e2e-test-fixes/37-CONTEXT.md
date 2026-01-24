# Phase 37: E2E Test Fixes

**Status:** Planning
**Created:** 2026-01-24
**Prerequisite:** Phase 36 (Stabilization)

## Overview

E2E tests run against the expanded demo-seed database (comprehensive data with 4 workspaces, 500+ users, rich message history) revealed 70 failing tests. This phase addresses test infrastructure fixes and selector updates needed for the demo-seed environment.

## Test Results Summary (2026-01-24)

| Metric | Count |
|--------|-------|
| **Total Tests** | 113 |
| **Passed** | 39 |
| **Failed** | 70 |
| **Skipped** | 4 |
| **Duration** | 3.2 minutes |

## Fixes Already Applied (Pre-Phase)

These issues were fixed during the initial test run:

1. **Bob's email corrected**: `bob.martinez@example.com` → `bob.chen@example.com` in `auth.setup.ts`
2. **demo-seed.ts**: First 5 users (Alice, Bob, Carol, David, Emma) now added to ALL workspaces including Acme Corp
3. **auth.setup.ts**: Changed workspace selection to navigate directly to `/acme-corp`
4. **docker-compose.test.yml**: Added Redis port exposure (`6380:6379`)

## Failing Tests Categorized

### Category 1: UI Selector Issues (Strict Mode Violations)

Tests failing because selectors match multiple elements:

| Test File | Test Name | Issue |
|-----------|-----------|-------|
| `core-flows.spec.ts:95` | user can send direct messages | `getByRole('button', { name: /new message/i })` matches 2 elements |
| `sidebar/drag-drop.spec.ts:27` | can drag channel to different category | `getByRole('button', { name: /new category/i })` matches multiple |

**Root Cause:** Demo-seed creates richer UI with more buttons visible.

**Fix Pattern:** Use more specific selectors with `exact: true` or `first()`.

---

### Category 2: Missing UI Elements

Tests failing because expected elements don't exist:

| Test File | Test Name | Missing Element |
|-----------|-----------|-----------------|
| `core-flows.spec.ts:16` | user can sign in and access workspace | `locator('nav')` not found |
| `core-flows.spec.ts:44` | user can send and receive messages | `getByRole('heading', { level: 1 })` for channel name |
| `core-flows.spec.ts:63` | user can create and reply to threads | `getByRole('list', { name: /messages/i })` |
| `core-flows.spec.ts:129` | user can react to messages | `locator('[data-message-id]')` |
| `core-flows.spec.ts:172` | user can search messages | Various search UI elements |

**Root Cause:** Tests may be landing on wrong page or UI structure changed.

**Fix Pattern:** Update selectors to match actual DOM structure, add navigation waits.

---

### Category 3: Security Tests

| Test File | Test Name | Issue |
|-----------|-----------|-------|
| `security/mfa.spec.ts:21` | MFA setup flow shows QR code | MFA UI locators |
| `security/mfa.spec.ts:52` | MFA verification with valid code | TOTP verification flow |
| `security/mfa.spec.ts:95` | MFA backup codes can be used | Backup code flow |
| `security/mfa.spec.ts:131` | MFA can be disabled | Disable MFA flow |
| `security/mfa.spec.ts:161` | session expires after inactivity | Session timeout test |
| `security/session.spec.ts:20` | session persists across page reload | Session persistence |
| `security/session.spec.ts:36` | logout clears session | Logout flow |
| `security/session.spec.ts:56` | session revocation works | Redis session revocation |
| `security/headers.spec.ts:11` | CSP header is present and configured | CSP header validation |
| `security/headers.spec.ts:35` | security headers are present | Security header checks |
| `security/headers.spec.ts:64` | no sensitive info in error messages | Error message sanitization |
| `security/headers.spec.ts:90` | rate limiting works | Rate limit testing |

**Root Cause:** Security tests may need specific test setup or environment.

---

### Category 4: Workspace Tests

| Test File | Test Name | Issue |
|-----------|-----------|-------|
| `workspace/discovery.spec.ts:16` | user can browse available workspaces | Browse UI |
| `workspace/discovery.spec.ts:61` | user can search workspaces | Search functionality |
| `workspace/discovery.spec.ts:89` | user can join open workspace | Join flow |
| `workspace/discovery.spec.ts:120` | request to join locked workspace | Join request flow |
| `workspace/discovery.spec.ts:147` | workspace join request creates pending request | Request creation |
| `workspace/discovery.spec.ts:171` | owner approves join request | Approval flow |
| `workspace/discovery.spec.ts:209` | multi-user: owner approves join request | Multi-user flow |
| `workspace/discovery.spec.ts:245` | user joining open workspace appears in switcher | Switcher update |
| `workspace/switcher.spec.ts:15` | user can see list of workspaces | Switcher list |
| `workspace/switcher.spec.ts:36` | user can switch workspaces | Workspace switching |
| `workspace/switcher.spec.ts:67` | workspace switcher shows unread counts | Unread display |
| `workspace/switcher.spec.ts:87` | workspace switcher shows browse workspaces link | Browse link |
| `workspace/switcher.spec.ts:104` | last visited workspace/channel is stored | Navigation persistence |
| `workspace/switcher.spec.ts:128` | switching workspace updates sidebar content | Sidebar sync |

---

### Category 5: Sidebar Tests

| Test File | Test Name | Issue |
|-----------|-----------|-------|
| `sidebar/drag-drop.spec.ts:27` | can drag channel to different category | DnD selectors |
| `sidebar/drag-drop.spec.ts:63` | can reorder channels within category | Within-category DnD |
| `sidebar/drag-drop.spec.ts:100` | can reorder DM conversations | DM reorder |
| `sidebar/drag-drop.spec.ts:131` | can reorder sidebar sections | Section reorder |
| `sidebar/drag-drop.spec.ts:166` | can reorder categories | Category reorder |
| `sidebar/sections.spec.ts:12` | sidebar shows expected sections | Section visibility |
| `sidebar/sections.spec.ts:35` | channels section shows workspace channels | Channel list |
| `sidebar/sections.spec.ts:55` | direct messages section shows conversations | DM list |
| `sidebar/sections.spec.ts:74` | clicking channel navigates to it | Channel navigation |

---

### Category 6: Mobile Tests

| Test File | Test Name | Issue |
|-----------|-----------|-------|
| `mobile/features.spec.ts:29` | user status can be set from mobile | Status UI |
| `mobile/features.spec.ts:58` | emoji picker works on mobile | Emoji picker |
| `mobile/features.spec.ts:91` | workspace analytics viewable on mobile | Analytics page |
| `mobile/features.spec.ts:116` | touch targets meet minimum size | Touch target size |
| `mobile/features.spec.ts:163` | consistent spacing across mobile views | Spacing validation |
| `mobile/features.spec.ts:198` | user groups manageable from mobile | User groups UI |
| `mobile/features.spec.ts:226` | guest management accessible from mobile | Guest UI |
| `mobile/features.spec.ts:256` | profile page accessible and responsive | Profile page |
| `mobile/features.spec.ts:280` | channel list touch targets on home | Home touch targets |
| `mobile/navigation.spec.ts:27` | bottom tab bar displays on mobile | Tab bar visibility |
| `mobile/navigation.spec.ts:45` | mobile navigation highlights current route | Route highlighting |
| `mobile/navigation.spec.ts:76` | More menu provides access to additional features | More menu |
| `mobile/navigation.spec.ts:110` | channel header uses overflow menu on mobile | Overflow menu |
| `mobile/navigation.spec.ts:146` | navigation to channel keeps home tab active | Tab state |
| `mobile/navigation.spec.ts:161` | More menu shows current status section | Status in menu |

**Note:** Mobile tests run on both `mobile-chrome` and `mobile-safari` projects.

---

## Recommended Fix Approach

### Wave 1: Infrastructure & Auth (Critical)
- Ensure auth state is consistently loaded
- Fix any navigation timing issues
- Verify base URL and workspace routing

### Wave 2: Core Flow Tests (High Priority)
- Fix selector issues in `core-flows.spec.ts`
- Update page objects if DOM structure changed
- Add explicit waits where needed

### Wave 3: Feature-Specific Tests (Medium Priority)
- Security tests
- Workspace tests
- Sidebar tests

### Wave 4: Mobile Tests (Lower Priority)
- Mobile navigation tests
- Mobile feature tests
- Responsive layout tests

## Files to Modify

### Test Files
- `e2e/tests/regression/core-flows.spec.ts`
- `e2e/tests/security/*.spec.ts`
- `e2e/tests/workspace/*.spec.ts`
- `e2e/tests/sidebar/*.spec.ts`
- `e2e/tests/mobile/*.spec.ts`

### Page Objects
- `e2e/pages/channel.page.ts`
- `e2e/pages/*.page.ts` (as needed)

### Test Fixtures
- `e2e/fixtures/test-fixtures.ts`

### Setup
- `e2e/tests/auth.setup.ts` (already partially fixed)

## Code Review Findings (CODE_REVIEW_06.MD)

In addition to E2E test failures, code review identified critical bugs:

### HIGH Severity

| Issue | Location | Impact |
|-------|----------|--------|
| Cross-org data leakage in exports | `export-data.ts:204-213` | DM notifications from other workspaces exported |
| Destructive scripts lack prod safety | `reset-and-seed.ts`, `seed.ts`, `e2e-seed.ts` | Can destroy production data |

### MEDIUM Severity

| Issue | Location | Impact |
|-------|----------|--------|
| E2E seed not idempotent | `e2e-seed.ts:158-226` | Duplicate key errors on rerun |
| Socket rate limit per-process only | `message.ts:90-95` | Bypass in multi-instance |
| Link preview no size limit | `link-preview.worker.ts:59-71` | Memory exhaustion |
| Restore script hides errors | `restore.sh:82-85` | Silent failures |

### LOW/MEDIUM Severity

| Issue | Location | Impact |
|-------|----------|--------|
| Export N+1 queries | `export-data.ts` multiple | Slow for large orgs |

---

## Success Criteria

- All 113 E2E tests pass with demo-seed data
- Tests are resilient to data variations
- No flaky tests due to timing issues
- Mobile tests pass on both Chrome and Safari emulators
- All HIGH severity code review issues fixed
- All MEDIUM severity code review issues fixed

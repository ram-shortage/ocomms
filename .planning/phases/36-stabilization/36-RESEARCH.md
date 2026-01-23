# Phase 36: Stabilization - Research

**Researched:** 2026-01-23
**Domain:** E2E Testing, Docker Compose, Integration Verification
**Confidence:** HIGH

## Summary

This research covers the technical approach for implementing a stabilization phase that verifies all v0.6.0 functionality works together in a production-like environment. The phase involves creating a Docker Compose test stack, implementing Playwright E2E tests for feature verification, and ensuring no regressions from v0.5.0.

The standard approach is to use Playwright with its official Docker images for E2E testing against a Docker Compose stack that mirrors production. Playwright's multi-browser context feature enables realistic multi-user testing scenarios (essential for realtime chat verification). The project already uses Vitest for unit tests and has a functional test script using Socket.IO client - the stabilization phase adds browser-based E2E testing on top.

**Primary recommendation:** Create `docker-compose.test.yml` extending the production compose file with test-appropriate settings, implement Playwright E2E tests organized by feature domain (auth, workspace, messaging, sidebar, mobile), and use setup projects for authentication state reuse.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | 1.58+ | E2E browser testing | Microsoft-maintained, multi-browser, built-in assertions, auto-wait |
| Docker Compose | 2.x | Test environment orchestration | Compose v2 with healthchecks, dependency ordering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mcr.microsoft.com/playwright | v1.58.0-noble | Pre-built Playwright Docker image | Running tests in CI/containerized environments |
| wait-on | 8.x | Wait for services to be ready | If compose healthchecks insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright | Cypress | Playwright has better multi-context support for multi-user testing |
| Docker Compose | Testcontainers | Compose simpler for this use case, already have docker-compose.yml |
| Manual auth setup | Playwright setup projects | Setup projects save time by reusing auth state |

**Installation:**
```bash
npm install -D @playwright/test
npx playwright install --with-deps
```

## Architecture Patterns

### Recommended Project Structure
```
e2e/
├── playwright.config.ts    # Playwright configuration
├── fixtures/
│   └── test-fixtures.ts    # Custom fixtures (auth, test data)
├── pages/
│   ├── login.page.ts       # Page Object: Login
│   ├── channel.page.ts     # Page Object: Channel view
│   ├── sidebar.page.ts     # Page Object: Sidebar
│   └── ...
├── tests/
│   ├── auth/
│   │   └── login.spec.ts   # Authentication flows
│   ├── workspace/
│   │   ├── switcher.spec.ts    # Workspace switching
│   │   └── discovery.spec.ts   # Browse/join workspaces
│   ├── messaging/
│   │   ├── send-receive.spec.ts  # Core messaging
│   │   └── realtime.spec.ts      # Multi-user realtime
│   ├── sidebar/
│   │   ├── reorder.spec.ts       # Drag-drop reordering
│   │   └── categories.spec.ts    # Category management
│   ├── mobile/
│   │   ├── navigation.spec.ts    # Mobile nav
│   │   └── features.spec.ts      # Mobile feature access
│   └── regression/
│       └── v050.spec.ts          # v0.5.0 regression tests
└── docker-compose.test.yml     # Test environment
```

### Pattern 1: Multi-Browser Context for Multi-User Testing
**What:** Create multiple isolated browser contexts within a single test to simulate different users interacting simultaneously.
**When to use:** Testing realtime features like chat messaging, presence, workspace joins.
**Example:**
```typescript
// Source: https://playwright.dev/docs/browser-contexts
import { test, expect, Browser } from '@playwright/test';

test('user A sends message, user B receives it', async ({ browser }) => {
  // Create two isolated contexts (separate sessions)
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // Login both users
  await loginAs(pageA, 'alice@example.com');
  await loginAs(pageB, 'bob@example.com');

  // Both navigate to same channel
  await pageA.goto('/acme-corp/channels/general');
  await pageB.goto('/acme-corp/channels/general');

  // User A sends message
  await pageA.getByRole('textbox', { name: /message/i }).fill('Hello from Alice');
  await pageA.keyboard.press('Enter');

  // User B should see message appear
  await expect(pageB.getByText('Hello from Alice')).toBeVisible({ timeout: 5000 });

  // Cleanup
  await contextA.close();
  await contextB.close();
});
```

### Pattern 2: Setup Project for Authentication State Reuse
**What:** Run authentication once and save browser state for reuse across all tests.
**When to use:** Reducing test execution time when many tests require authenticated state.
**Example:**
```typescript
// Source: https://playwright.dev/docs/test-projects
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // Setup project runs first
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Main tests depend on setup
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Mobile project with separate auth
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

### Pattern 3: Docker Compose Test Environment
**What:** Extend production compose with test-specific overrides.
**When to use:** Running E2E tests against a production-like environment.
**Example:**
```yaml
# docker-compose.test.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: ocomms_test
    tmpfs:
      - /var/lib/postgresql/data  # RAM disk for speed
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    command: redis-server
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://postgres:testpass@db:5432/ocomms_test
      - REDIS_URL=redis://redis:6379
      - BETTER_AUTH_SECRET=test-secret-min-32-chars-long-here
      - BETTER_AUTH_URL=http://localhost:3000
      - NEXT_PUBLIC_APP_URL=http://localhost:3000
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 15
      start_period: 60s
```

### Anti-Patterns to Avoid
- **Testing against dev server:** Use production builds only; dev mode has different behavior (hot reload, debug logs)
- **Shared test data:** Each test should set up its own data; don't rely on leftover state
- **Hardcoded waits:** Use Playwright's auto-wait and `expect().toBeVisible()` instead of `page.waitForTimeout()`
- **Testing implementation details:** Test user-visible behavior, not CSS classes or internal state
- **Login in every test:** Use setup projects or shared auth state
- **Ignoring test isolation:** Each test should clean up or use fresh context

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom Puppeteer scripts | Playwright test runner | Built-in assertions, auto-wait, parallelism |
| Service orchestration | Shell scripts | Docker Compose healthchecks | Proper dependency ordering, health-based waits |
| Auth state management | Manual cookie injection | Playwright storageState | Handles cookies, localStorage, IndexedDB |
| Mobile emulation | Manual viewport setting | Playwright devices registry | Complete device profiles (userAgent, touch, etc.) |
| Visual regression | Manual screenshots | Playwright snapshot testing | Built-in screenshot comparison |
| Multi-user testing | Separate test processes | Browser contexts | Isolated but efficient, single browser instance |

**Key insight:** Playwright has built-in solutions for most E2E testing challenges. The test runner handles parallelism, retries, and reporting automatically.

## Common Pitfalls

### Pitfall 1: Flaky Realtime Tests
**What goes wrong:** Tests fail intermittently when checking for realtime updates (messages, presence, typing indicators).
**Why it happens:** Network latency, WebSocket connection timing, race conditions between test assertions and server events.
**How to avoid:**
- Use Playwright's `expect().toBeVisible({ timeout: X })` with generous timeouts for realtime assertions
- Wait for specific content rather than arbitrary delays
- Consider retry configuration in playwright.config.ts
**Warning signs:** Tests pass locally but fail in CI; tests pass when run individually but fail in parallel.

### Pitfall 2: Docker Service Startup Race
**What goes wrong:** Tests start before app is fully ready, causing connection refused or 500 errors.
**Why it happens:** `depends_on` only waits for container start, not service readiness.
**How to avoid:**
- Use `condition: service_healthy` in compose
- Implement comprehensive healthchecks
- Use Playwright's webServer configuration with `reuseExistingServer: true`
- Add `start_period` to give services time to initialize
**Warning signs:** First test always fails, subsequent tests pass.

### Pitfall 3: Test Data Pollution
**What goes wrong:** Tests fail because they depend on data from previous tests or previous runs.
**Why it happens:** Database not reset between runs; tests modify shared state.
**How to avoid:**
- Create fresh test users/workspaces per test or test suite
- Use database seeding script before test runs
- Consider test isolation via unique identifiers (timestamps, UUIDs)
**Warning signs:** Tests fail when run in different order; tests pass on clean DB but fail on existing DB.

### Pitfall 4: Mobile Emulation Gaps
**What goes wrong:** Tests pass in mobile emulation but real mobile issues exist.
**Why it happens:** Emulation simulates viewport and touch, not actual mobile browser behavior.
**How to avoid:**
- Use emulation for responsive layout testing (viewport, touch events)
- Don't rely on emulation for performance or browser-specific bugs
- Test actual mobile viewport sizes that match your CSS breakpoints
- Consider visual regression for layout verification
**Warning signs:** Users report mobile issues that tests don't catch.

### Pitfall 5: Authentication Session Expiry
**What goes wrong:** Tests fail midway with 401 errors or redirects to login.
**Why it happens:** Saved auth state expires during long test runs.
**How to avoid:**
- Use setup projects that run before each project
- Set appropriate session TTL for test environment
- Re-authenticate in fixture if session nearing expiry
**Warning signs:** First few tests pass, later tests fail with auth errors.

## Code Examples

Verified patterns from official sources:

### Playwright Configuration
```typescript
// Source: https://playwright.dev/docs/test-configuration
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Auth setup
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
    },

    // Mobile viewport testing
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
      testMatch: /.*mobile.*\.spec\.ts/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'], storageState: '.auth/user.json' },
      dependencies: ['setup'],
      testMatch: /.*mobile.*\.spec\.ts/,
    },
  ],

  // Start app server before tests
  webServer: {
    command: 'docker compose -f docker-compose.test.yml up',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Authentication Setup
```typescript
// Source: https://playwright.dev/docs/auth
// e2e/tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/sign-in');

  await page.getByLabel('Email').fill('alice@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for redirect to workspace
  await page.waitForURL(/\/[^/]+$/);

  // Verify logged in
  await expect(page.getByRole('button', { name: /profile/i })).toBeVisible();

  // Save auth state
  await page.context().storageState({ path: authFile });
});
```

### Page Object Model
```typescript
// Source: https://playwright.dev/docs/pom
// e2e/pages/channel.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class ChannelPage {
  readonly page: Page;
  readonly messageInput: Locator;
  readonly messageList: Locator;
  readonly sendButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messageInput = page.getByRole('textbox', { name: /message/i });
    this.messageList = page.getByRole('list', { name: /messages/i });
    this.sendButton = page.getByRole('button', { name: /send/i });
  }

  async goto(workspaceSlug: string, channelSlug: string) {
    await this.page.goto(`/${workspaceSlug}/channels/${channelSlug}`);
    await expect(this.messageList).toBeVisible();
  }

  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await this.messageInput.press('Enter');
    await expect(this.page.getByText(text)).toBeVisible();
  }

  async expectMessageVisible(text: string, timeout = 5000) {
    await expect(this.page.getByText(text)).toBeVisible({ timeout });
  }
}
```

### Mobile Viewport Testing
```typescript
// Source: https://playwright.dev/docs/emulation
// e2e/tests/mobile/navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation', () => {
  test('bottom tab bar navigates correctly', async ({ page }) => {
    await page.goto('/acme-corp');

    // Mobile tab bar should be visible
    const tabBar = page.getByRole('navigation', { name: /mobile/i });
    await expect(tabBar).toBeVisible();

    // Navigate to DMs
    await tabBar.getByRole('link', { name: /messages|dm/i }).click();
    await expect(page).toHaveURL(/\/dm/);

    // Navigate to Search
    await tabBar.getByRole('link', { name: /search/i }).click();
    await expect(page).toHaveURL(/\/search/);

    // Navigate back to Home
    await tabBar.getByRole('link', { name: /home/i }).click();
    await expect(page).toHaveURL(/\/acme-corp$/);
  });

  test('sidebar is hidden on mobile', async ({ page }) => {
    await page.goto('/acme-corp');

    // Desktop sidebar should be hidden
    const sidebar = page.getByRole('complementary', { name: /sidebar/i });
    await expect(sidebar).not.toBeVisible();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Selenium WebDriver | Playwright | 2020-2023 | Much faster, better reliability, built-in assertions |
| cypress-wait-until | Playwright auto-wait | 2020+ | No manual waits needed for most cases |
| docker-compose v1 | docker compose v2 | 2023+ | Better healthcheck support, compose as Docker plugin |
| Manual mobile viewports | Playwright devices registry | 2020+ | Complete device emulation profiles |
| Environment variables for auth | storageState | 2021+ | Proper session/cookie persistence |

**Deprecated/outdated:**
- WebDriverIO for new projects: Playwright is preferred for modern web apps
- Manual browser installation: `npx playwright install --with-deps` handles everything
- Separate test DB containers: tmpfs mounts on same container are faster

## Open Questions

Things that couldn't be fully resolved:

1. **Realtime test timing sensitivity**
   - What we know: Playwright has auto-wait and configurable timeouts
   - What's unclear: Optimal timeout values for Socket.IO message propagation in CI environment
   - Recommendation: Start with 5000ms timeout for realtime assertions, tune based on CI results

2. **Test database seeding strategy**
   - What we know: Project has `npm run db:seed` and demo-seed scripts
   - What's unclear: Whether to seed once per test suite or reset per test
   - Recommendation: Seed once at start, use unique identifiers in tests to avoid conflicts

3. **CI parallelization vs Docker resources**
   - What we know: Playwright supports parallelization, Docker Compose can be resource-intensive
   - What's unclear: Optimal worker count for CI environment
   - Recommendation: Start with `workers: 1` in CI, increase if resources allow

## Sources

### Primary (HIGH confidence)
- [Playwright Official Documentation - Best Practices](https://playwright.dev/docs/best-practices) - Test isolation, locators, authentication
- [Playwright Official Documentation - Browser Contexts](https://playwright.dev/docs/browser-contexts) - Multi-user testing
- [Playwright Official Documentation - Docker](https://playwright.dev/docs/docker) - Docker images and configuration
- [Playwright Official Documentation - Emulation](https://playwright.dev/docs/emulation) - Mobile device emulation
- [Playwright Official Documentation - Test Projects](https://playwright.dev/docs/test-projects) - Project configuration
- [Next.js Testing Guide - Playwright](https://nextjs.org/docs/pages/guides/testing/playwright) - Next.js integration

### Secondary (MEDIUM confidence)
- [BrowserStack - Playwright Docker Tutorial](https://www.browserstack.com/guide/playwright-docker) - Docker integration patterns
- [BrowserStack - 15 Best Practices for Playwright 2026](https://www.browserstack.com/guide/playwright-best-practices) - Current best practices
- [DZone - Playwright Testing WebSockets](https://dzone.com/articles/playwright-for-real-time-applications-testing-webs) - Realtime testing patterns
- [Medium - E2E Testing with Playwright and Docker](https://medium.com/geekculture/e2e-testing-with-playwright-and-docker-91dd7eb11793) - Docker Compose patterns

### Project Context (HIGH confidence)
- Existing `docker-compose.yml` and `docker-compose.dev.yml` - Production patterns
- Existing `tests/functional.test.ts` - Current Socket.IO-based functional tests
- Existing unit tests in `src/**/__tests__/` - Test organization patterns
- Verification reports from phases 30-32 - Security requirements to verify

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright is well-documented, Docker Compose patterns are established
- Architecture: HIGH - Official docs provide clear project structure guidance
- Pitfalls: MEDIUM - Based on community experience, may need adjustment for this specific project

**Research date:** 2026-01-23
**Valid until:** 60 days (Playwright stable, patterns established)

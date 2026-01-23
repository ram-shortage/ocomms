import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page object for the login/sign-in page.
 * Provides methods for authentication flows.
 */
export class LoginPage {
  readonly page: Page;

  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly errorMessage: Locator;
  readonly signUpLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password/i);
    this.signInButton = page.getByRole('button', { name: /sign in/i });
    this.errorMessage = page.getByRole('alert');
    this.signUpLink = page.getByRole('link', { name: /sign up/i });
  }

  /**
   * Navigate to the login page.
   */
  async goto() {
    await this.page.goto('/login');
  }

  /**
   * Fill in credentials and submit the login form.
   */
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  /**
   * Assert that login was successful by checking for workspace redirect.
   */
  async expectLoggedIn() {
    // After successful login, user is redirected to their workspace
    await expect(this.page).toHaveURL(/\/[a-z0-9-]+$/, { timeout: 30000 });
  }

  /**
   * Assert that an error message is displayed.
   */
  async expectError(message?: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }
}

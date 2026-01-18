/**
 * Validate password meets complexity requirements.
 * Returns array of error messages (empty if valid).
 *
 * Rules (from SEC-04):
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one symbol (non-alphanumeric)
 */
export function validatePasswordComplexity(password: string): string[] {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password needs an uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password needs a lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password needs a number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password needs a symbol");
  }

  return errors;
}

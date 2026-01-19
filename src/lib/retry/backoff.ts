/**
 * Exponential backoff with jitter for retry logic.
 * Based on AWS best practices: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */

/**
 * Configuration for backoff calculation.
 */
export interface BackoffConfig {
  /** Initial delay in milliseconds (default: 1000) */
  baseDelay: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay: number;
  /** Maximum random jitter in milliseconds (default: 500) */
  maxJitter: number;
  /** Maximum number of retry attempts (default: 5) */
  maxRetries: number;
}

/**
 * Default backoff configuration.
 * Produces delays of approximately: 1s, 2s, 4s, 8s, 16s (capped at 30s)
 */
export const DEFAULT_CONFIG: BackoffConfig = {
  baseDelay: 1000,
  maxDelay: 30000,
  maxJitter: 500,
  maxRetries: 5,
};

/**
 * Calculate delay with exponential backoff and full jitter.
 * Formula: min(maxDelay, baseDelay * 2^attempt) + random(0, maxJitter)
 *
 * @param attempt - The retry attempt number (0-indexed)
 * @param config - Optional partial config to override defaults
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  config?: Partial<BackoffConfig>
): number {
  const { baseDelay, maxDelay, maxJitter } = { ...DEFAULT_CONFIG, ...config };

  // Exponential growth: baseDelay * 2^attempt, capped at maxDelay
  const exponential = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));

  // Add random jitter to spread out retries (avoid thundering herd)
  const jitter = Math.random() * maxJitter;

  return exponential + jitter;
}

/**
 * Check if more retries are allowed.
 *
 * @param retryCount - Current number of retries attempted
 * @param config - Optional partial config to override defaults
 * @returns true if retryCount < maxRetries
 */
export function shouldRetry(
  retryCount: number,
  config?: Partial<BackoffConfig>
): boolean {
  const { maxRetries } = { ...DEFAULT_CONFIG, ...config };
  return retryCount < maxRetries;
}

/**
 * Sleep for the specified duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

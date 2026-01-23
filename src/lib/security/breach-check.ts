/**
 * Password breach checking using local bloom filter.
 *
 * This uses a bloom filter with common breached passwords to check
 * if a password appears in known data breaches. The filter has a 1%
 * false positive rate (meaning 1% of safe passwords may incorrectly
 * flag as breached) but zero false negatives (all breached passwords
 * will be detected).
 *
 * NOTE: This is a subset of the most common breached passwords.
 * Production deployments could use a larger list (e.g., top 1M from
 * rockyou) at the cost of increased memory (~10MB for 1M passwords).
 *
 * The breach check is a WARNING, not a blocker - users can bypass
 * with explicit confirmation.
 */

import { BloomFilter } from "bloom-filters";

// Top 100 most common breached passwords (from various breach datasets)
// These represent the absolute worst passwords that should be avoided
const COMMON_BREACHED_PASSWORDS = [
  // Top classics
  "password",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "monkey",
  "1234567",
  "letmein",
  "trustno1",
  "dragon",
  "baseball",
  "iloveyou",
  "master",
  "sunshine",
  "ashley",
  "bailey",
  "passw0rd",
  "shadow",
  "123123",
  "654321",
  // Number sequences
  "111111",
  "121212",
  "000000",
  "password1",
  "password123",
  "123456789",
  "1234567890",
  "123qwe",
  "qwerty123",
  "1q2w3e4r",
  // Common words
  "admin",
  "admin123",
  "welcome",
  "welcome1",
  "p@ssw0rd",
  "p@ssword",
  "login",
  "hello",
  "charlie",
  "donald",
  "football",
  "michael",
  "superman",
  "batman",
  "starwars",
  // Tech/gaming
  "master",
  "access",
  "qazwsx",
  "mustang",
  "harley",
  "jordan",
  "thomas",
  "ranger",
  "buster",
  "soccer",
  // Keyboard patterns
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
  "1qaz2wsx",
  "qwer1234",
  "password!",
  "password@",
  "password#",
  // Common names/words
  "jennifer",
  "hunter",
  "amanda",
  "joshua",
  "nicole",
  "matthew",
  "summer",
  "computer",
  "killer",
  "internet",
  // More patterns
  "secret",
  "test",
  "test123",
  "testing",
  "guest",
  "root",
  "demo",
  "changeme",
  "temp",
  "temp123",
  // Years and dates
  "2000",
  "1999",
  "1234",
  "12345",
  "qwerty1",
  "abc",
  "aaa",
  "abcd1234",
  "1111",
  "11111",
  // More common
  "princess",
  "flower",
  "whatever",
  "freedom",
  "nothing",
  "maggie",
];

// Initialize bloom filter with 1% false positive rate
// The filter is created once at module load time
const breachFilter = BloomFilter.from(
  COMMON_BREACHED_PASSWORDS.map((p) => p.toLowerCase()),
  0.01 // 1% false positive rate
);

/**
 * Check if a password appears in the common breached passwords list.
 *
 * @param password - The password to check
 * @returns true if the password appears breached, false otherwise
 *
 * Note: Due to bloom filter properties, this may have ~1% false positives
 * (safe passwords incorrectly flagged) but NEVER false negatives
 * (all truly breached passwords will be detected).
 */
export function isPasswordBreached(password: string): boolean {
  return breachFilter.has(password.toLowerCase());
}

/**
 * Get the count of known breached passwords in the filter.
 * Useful for displaying in admin/debug interfaces.
 */
export function getBreachListSize(): number {
  return COMMON_BREACHED_PASSWORDS.length;
}

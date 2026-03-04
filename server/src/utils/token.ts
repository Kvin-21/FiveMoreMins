import crypto from 'crypto';

/**
 * Generate a cryptographically random hex token.
 * Default is 32 bytes → 64 hex chars, which is plenty for magic links.
 */
export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a 6-digit numeric code — handy for SMS / TOTP style flows
 * if we ever add that. Not crypto-random in the strict sense but fine
 * for a short-lived OTP.
 */
export function generateShortToken(): string {
  // Stay in the 100000–999999 range so it's always 6 digits
  const value = crypto.randomInt(100000, 1000000);
  return value.toString();
}

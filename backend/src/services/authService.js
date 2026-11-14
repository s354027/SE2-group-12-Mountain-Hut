import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';

const SALT_ROUNDS = 10;

// Password recovery links expire after 24 hours (MH-07, NIST SP 800-63A §3.8)
export const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const MIN_PASSWORD_LENGTH = 6;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Random password for hiker accounts created by an employee (MH-07).
 * It is shown once to the employee, who can communicate it verbally.
 * @returns {string} 12 URL-safe characters (~72 bits of entropy)
 */
export function generateRandomPassword() {
  return randomBytes(9).toString('base64url');
}

/**
 * Random token for the password recovery link (well above the
 * 6 decimal digits required by NIST SP 800-63A §3.8).
 * @returns {string}
 */
export function generateResetToken() {
  return randomBytes(32).toString('base64url');
}

/**
 * Only the hash of a reset token is stored in the database.
 * @param {string} token
 * @returns {string}
 */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

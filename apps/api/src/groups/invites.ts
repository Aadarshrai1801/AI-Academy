import { randomInt } from 'crypto';

/**
 * Invite-link helpers (spec §2.4: expiring/rotatable invite links).
 * Pure functions — unit-tested.
 */

/**
 * Unambiguous uppercase alphabet: no 0/O, 1/I/L confusions, no lowercase,
 * no `-`/`_` (base64url leftovers). Users type these by hand, so every
 * character must survive reading, typing, and uppercasing.
 */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

export function generateInviteCode(length = INVITE_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

/**
 * What the user typed → what we compare. Trims, drops pasted whitespace,
 * and uppercases: the join box uppercases input, and legacy codes were
 * mixed-case base64url, so matching must not depend on the user's casing.
 */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function inviteExpiry(from = new Date(), days = 7): Date {
  return new Date(from.getTime() + days * 86400000);
}

export function isInviteValid(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true; // never-expire legacy links
  return new Date(expiresAt).getTime() > now.getTime();
}

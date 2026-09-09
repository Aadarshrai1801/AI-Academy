import { randomBytes } from 'crypto';

/**
 * Invite-link helpers (spec §2.4: expiring/rotatable invite links).
 * Pure functions — unit-tested.
 */
export function generateInviteCode(bytes = 6): string {
  return randomBytes(bytes).toString('base64url');
}

export function inviteExpiry(from = new Date(), days = 7): Date {
  return new Date(from.getTime() + days * 86400000);
}

export function isInviteValid(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true; // never-expire legacy links
  return new Date(expiresAt).getTime() > now.getTime();
}

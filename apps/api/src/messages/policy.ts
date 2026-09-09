import { Role } from '../common/entitlements.service.js';

/**
 * Retention + throttle policy (spec §2.4, §6.2: free 30-day history;
 * spec §5.5: per-user send rate limits). Pure — unit-tested.
 */
export const HISTORY_RETENTION_DAYS: Record<Role, number> = { free: 30, pro: -1, admin: -1 };

/** Max messages per rolling minute (spec §5.5 spam blunting). */
export const SENDS_PER_MINUTE: Record<Role, number> = { free: 20, pro: 120, admin: -1 };

export function retentionCutoff(role: Role, now = new Date()): Date | null {
  const days = HISTORY_RETENTION_DAYS[role];
  if (days === -1) return null;
  return new Date(now.getTime() - days * 86400000);
}

export function throttleKey(userId: string, minute: string) {
  return `chat:${userId}:${minute}`;
}

export function currentMinute(d = new Date()) {
  return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
}

import { Role } from '../common/entitlements.service.js';

/**
 * Call policy (spec §2.5, §6.2): free 1:1 ≤15 min, pro group calls +
 * screen share with a generous anti-abuse ceiling. Pure — unit-tested.
 */
export const FREE_CALL_MINUTES = 15;
export const MAX_GROUP_CALL_SIZE = 10;

export function proMaxMinutes(): number {
  const v = Number(process.env.CALL_PRO_MAX_MINUTES);
  return Number.isFinite(v) && v > 0 ? v : 240;
}

/** Scheduled hard-stop for a call (server-side, never UI-only — spec §5.4). */
export function capMinutesFor(role: Role, remainingDailyMin: number): number {
  if (role === 'free') return Math.min(FREE_CALL_MINUTES, Math.max(0, remainingDailyMin));
  return proMaxMinutes();
}

export function canStartGroupCall(role: Role): boolean {
  return role === 'pro' || role === 'admin';
}

export type MediaTrackSource = 'microphone' | 'camera' | 'screen_share' | 'screen_share_audio';

export function publishSourcesFor(role: Role): MediaTrackSource[] {
  const base: MediaTrackSource[] = ['microphone', 'camera'];
  return role === 'free' ? base : [...base, 'screen_share', 'screen_share_audio'];
}

export function minutesForDuration(totalSec: number): number {
  return Math.max(1, Math.ceil(totalSec / 60));
}

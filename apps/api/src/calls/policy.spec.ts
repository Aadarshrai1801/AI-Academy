import {
  FREE_CALL_MINUTES,
  canStartGroupCall,
  capMinutesFor,
  minutesForDuration,
  publishSourcesFor,
} from './policy.js';

describe('call policy', () => {
  it('caps free calls at 15 min (or remaining quota)', () => {
    expect(capMinutesFor('free', 30)).toBe(FREE_CALL_MINUTES);
    expect(capMinutesFor('free', 5)).toBe(5);
    expect(capMinutesFor('pro', 0)).toBeGreaterThan(FREE_CALL_MINUTES);
  });

  it('restricts group calls + screen share to paid tiers', () => {
    expect(canStartGroupCall('free')).toBe(false);
    expect(canStartGroupCall('pro')).toBe(true);
    expect(publishSourcesFor('free')).not.toContain('screen_share');
    expect(publishSourcesFor('pro')).toContain('screen_share');
  });

  it('bills whole minutes, minimum 1', () => {
    expect(minutesForDuration(0)).toBe(1);
    expect(minutesForDuration(61)).toBe(2);
  });
});

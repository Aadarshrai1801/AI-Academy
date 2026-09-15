import { msUntilNextUtcRun, percentile, SNAPSHOT_CRON } from './leaderboard.service.js';

describe('percentile', () => {
  it('computes rank percentile over field size', () => {
    expect(percentile(1, 100)).toBe(100);
    expect(percentile(100, 100)).toBe(0);
    expect(percentile(1, 1)).toBe(100);
    expect(percentile(null, 50)).toBeNull();
    expect(percentile(3, 0)).toBeNull();
  });
});

describe('nightly snapshot scheduling', () => {
  it('uses a 00:05 UTC cron', () => {
    expect(SNAPSHOT_CRON).toBe('5 0 * * *');
    const [min, hour] = SNAPSHOT_CRON.split(' ');
    expect(Number(min)).toBe(5);
    expect(Number(hour)).toBe(0);
  });

  it('msUntilNextUtcRun points at the next 00:05 UTC boundary', () => {
    // 23:00 UTC → 65 minutes away.
    const at2300 = Date.UTC(2026, 0, 1, 23, 0, 0, 0);
    expect(msUntilNextUtcRun(at2300)).toBe(65 * 60 * 1000);
    // 00:06 UTC → ~a full day away (already past today's run).
    const at0006 = Date.UTC(2026, 0, 2, 0, 6, 0, 0);
    const delay = msUntilNextUtcRun(at0006);
    expect(delay).toBeGreaterThan(23 * 3600 * 1000);
    expect(delay).toBeLessThanOrEqual(24 * 3600 * 1000);
    // Exactly 00:05 UTC → schedules tomorrow (must be > 0, never fire twice).
    const at0005 = Date.UTC(2026, 0, 2, 0, 5, 0, 0);
    expect(msUntilNextUtcRun(at0005)).toBe(24 * 3600 * 1000);
  });
});

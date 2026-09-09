import { currentMinute, retentionCutoff, throttleKey } from './policy.js';

describe('chat policy', () => {
  it('cuts free history at 30 days, pro unlimited', () => {
    const now = new Date('2026-09-08T12:00:00Z');
    expect(retentionCutoff('free', now)?.toISOString()).toBe('2026-08-09T12:00:00.000Z');
    expect(retentionCutoff('pro', now)).toBeNull();
  });

  it('buckets throttle keys per minute', () => {
    expect(throttleKey('u1', currentMinute(new Date('2026-09-08T12:00:30Z')))).toBe(
      'chat:u1:2026-09-08T12:00',
    );
  });
});

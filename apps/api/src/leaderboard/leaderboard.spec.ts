import { percentile } from './leaderboard.service.js';

describe('percentile', () => {
  it('computes rank percentile over field size', () => {
    expect(percentile(1, 100)).toBe(100);
    expect(percentile(100, 100)).toBe(0);
    expect(percentile(1, 1)).toBe(100);
    expect(percentile(null, 50)).toBeNull();
    expect(percentile(3, 0)).toBeNull();
  });
});

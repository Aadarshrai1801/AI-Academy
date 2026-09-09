import { generateInviteCode, inviteExpiry, isInviteValid } from './invites.js';

describe('invite links', () => {
  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
    expect(codes.size).toBe(100);
  });

  it('expires after the window', () => {
    const exp = inviteExpiry(new Date('2026-01-01T00:00:00Z'), 7);
    expect(isInviteValid(exp, new Date('2026-01-05T00:00:00Z'))).toBe(true);
    expect(isInviteValid(exp, new Date('2026-01-08T00:00:01Z'))).toBe(false);
  });
});

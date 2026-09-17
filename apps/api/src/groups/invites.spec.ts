import {
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  generateInviteCode,
  inviteExpiry,
  isInviteValid,
  normalizeInviteCode,
} from './invites.js';
import { GroupsService } from './groups.service.js';

describe('invite links', () => {
  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
    expect(codes.size).toBe(100);
  });

  it('generates 6-character unambiguous uppercase codes', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code).toBe(code.toUpperCase());
      for (const ch of code) expect(INVITE_ALPHABET).toContain(ch);
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it('normalizes typed codes (case, whitespace)', () => {
    expect(normalizeInviteCode('  a3f9b2\n')).toBe('A3F9B2');
    expect(normalizeInviteCode('ab-cd_ef')).toBe('AB-CD_EF');
  });

  it('expires after the window', () => {
    const exp = inviteExpiry(new Date('2026-01-01T00:00:00Z'), 7);
    expect(isInviteValid(exp, new Date('2026-01-05T00:00:00Z'))).toBe(true);
    expect(isInviteValid(exp, new Date('2026-01-08T00:00:01Z'))).toBe(false);
  });
});

describe('groups join by invite code', () => {
  function makeService(storedCode: string, expiresAt: Date | null = null) {
    const doc: any = {
      _id: 'group1',
      name: 'Cohort',
      owner_id: 'owner1',
      privacy: 'invite_only',
      member_ids: ['owner1'],
      member_count: 1,
      max_members: 10,
      invite_code: storedCode,
      invite_code_expires_at: expiresAt,
      save: async () => undefined,
    };
    const groups = {
      findOne: (filter: any) => ({
        exec: async () => {
          const wanted = filter.invite_code;
          if (typeof wanted === 'string') return doc.invite_code === wanted ? doc : null;
          const re = new RegExp(wanted.$regex, wanted.$options ?? '');
          return re.test(doc.invite_code) ? doc : null;
        },
      }),
    };
    // GroupsService constructor: (groups model, leaderboard) — both faked.
    return new GroupsService(groups as any, {} as any);
  }

  it('joins with a new-style code typed in lowercase', async () => {
    const service = makeService('A3F9B2');
    const joined = await service.join('user2', 'a3f9b2');
    expect(joined.name).toBe('Cohort');
  });

  it('joins with a legacy mixed-case code typed uppercased (the old 404)', async () => {
    const service = makeService('aB3_x9Qz');
    const joined = await service.join('user2', 'AB3_X9QZ');
    expect(joined.name).toBe('Cohort');
  });

  it('rejects unknown codes with 404 and expired codes with 410', async () => {
    const service = makeService('A3F9B2');
    await expect(service.join('user2', 'ZZZZZZ')).rejects.toMatchObject({ status: 404 });
    const expired = makeService('A3F9B2', new Date('2020-01-01T00:00:00Z'));
    await expect(expired.join('user2', 'A3F9B2')).rejects.toMatchObject({ status: 410 });
  });
});

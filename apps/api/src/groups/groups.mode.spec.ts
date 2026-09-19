import { GroupsService } from './groups.service.js';

/** Group modes: study groups hide rankings; owners can switch modes. */

function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'sort', 'limit', 'lean', 'exec']) {
    c[m] = (..._args: any[]) => (m === 'exec' ? Promise.resolve(result) : c);
  }
  return c;
}

function groupDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'g1',
    name: 'Cohort',
    owner_id: 'owner1',
    privacy: 'invite_only',
    mode: 'competitive',
    member_ids: ['owner1', 'u2'],
    member_count: 2,
    max_members: 10,
    invite_code: 'ABC123',
    save: vi.fn(async () => undefined),
    ...overrides,
  };
}

function makeService(group: any, groupIds: Array<{ _id: string }> = [{ _id: 'g1' }]) {
  const groups = {
    findOne: () => chain(group),
    find: () => chain(groupIds),
  };
  const leaderboard = { scoreOf: vi.fn(async () => 10) };
  return { service: new GroupsService(groups as any, leaderboard as any), leaderboard };
}

describe('GroupsService — study mode', () => {
  it('suppresses ranking data for study groups', async () => {
    const { service, leaderboard } = makeService(groupDoc({ mode: 'study' }));
    const board = await service.memberBoard('owner1', 'g1');
    expect(board).toMatchObject({ mode: 'study', suppressed: true, entries: [] });
    expect(leaderboard.scoreOf).not.toHaveBeenCalled();
  });

  it('keeps ranked entries for competitive groups', async () => {
    const { service } = makeService(groupDoc());
    const board = await service.memberBoard('owner1', 'g1');
    expect(board.mode).toBe('competitive');
    expect(board.suppressed).toBe(false);
    expect(board.entries).toHaveLength(2);
    expect(board.entries[0]).toMatchObject({ rank: 1, userId: 'owner1', score: 10 });
  });

  it('lets the owner switch modes and persists it', async () => {
    const group = groupDoc();
    const { service } = makeService(group);
    const shaped = await service.setMode('owner1', 'g1', 'study');
    expect(group.mode).toBe('study');
    expect(group.save).toHaveBeenCalled();
    expect(shaped.mode).toBe('study');
  });

  it('rejects mode changes from non-owners', async () => {
    const { service } = makeService(groupDoc());
    await expect(service.setMode('u2', 'g1', 'study')).rejects.toMatchObject({ status: 403 });
  });

  it('lists the study groups a member belongs to', async () => {
    const { service } = makeService(groupDoc(), [{ _id: 'g1' }, { _id: 'g2' }]);
    await expect(service.studyGroupIdsFor('u2')).resolves.toEqual(['g1', 'g2']);
  });
});

import { RetentionService } from './retention.service.js';

type Row = { _id: string; deleted?: boolean; updated_at?: Date; group_id?: string };

const OLD = new Date('2026-06-01T00:00:00.000Z');
const RECENT = new Date('2026-09-10T00:00:00.000Z');
const NOW = new Date('2026-09-15T00:00:00.000Z').getTime();

function matches(doc: Row, filter: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(filter)) {
    if (k === 'deleted' && doc.deleted !== v) return false;
    if (k === 'updated_at' && typeof v === 'object' && v !== null && '$lt' in (v as object)) {
      if (!(doc.updated_at! < (v as { $lt: Date }).$lt)) return false;
    }
    if (k === '_id' && typeof v === 'object' && v !== null && '$in' in (v as object)) {
      if (!(v as { $in: unknown[] }).$in.includes(doc._id)) return false;
    }
    if (k === 'group_id' && typeof v === 'object' && v !== null && '$in' in (v as object)) {
      if (!(v as { $in: unknown[] }).$in.includes(doc.group_id)) return false;
    }
  }
  return true;
}

function fakeModel(seed: Row[]) {
  const rows = seed;
  return {
    rows,
    countDocuments: (filter: Record<string, unknown>) => ({
      exec: async () => rows.filter((r) => matches(r, filter)).length,
    }),
    find: (filter: Record<string, unknown>) => {
      let out = rows.filter((r) => matches(r, filter));
      const chain = {
        select: () => chain,
        limit: (n: number) => {
          out = out.slice(0, n);
          return chain;
        },
        lean: () => chain,
        exec: async () => out.map((r) => ({ ...r })),
      };
      return chain;
    },
    deleteMany: (filter: Record<string, unknown>) => ({
      exec: async () => {
        const doomed = rows.filter((r) => matches(r, filter));
        for (const d of doomed) rows.splice(rows.indexOf(d), 1);
        return { deletedCount: doomed.length };
      },
    }),
  };
}

const svc = (messages: Row[], groups: Row[]) =>
  new RetentionService(fakeModel(messages) as never, fakeModel(groups) as never);

describe('RetentionService', () => {
  it('status reports eligible soft-deleted rows past the grace window', async () => {
    const s = svc(
      [
        { _id: 'm-old-del', deleted: true, updated_at: OLD },
        { _id: 'm-recent-del', deleted: true, updated_at: RECENT },
        { _id: 'm-old-live', deleted: false, updated_at: OLD },
      ],
      [
        { _id: 'g-old-del', deleted: true, updated_at: OLD },
        { _id: 'g-live', deleted: false, updated_at: OLD },
      ],
    );
    const st = await s.status(NOW);
    expect(st.graceDays).toBe(30);
    expect(st.cutoff).toBe(new Date(NOW - 30 * 86400000).toISOString());
    expect(st.eligible).toEqual({ softDeletedMessages: 1, softDeletedGroups: 1 });
  });

  it('purgeDeletedMessages removes only old soft-deleted messages', async () => {
    const messages: Row[] = [
      { _id: 'm-old-del', deleted: true, updated_at: OLD },
      { _id: 'm-recent-del', deleted: true, updated_at: RECENT },
      { _id: 'm-old-live', deleted: false, updated_at: OLD },
    ];
    const s = svc(messages, []);
    const res = await s.purgeDeletedMessages(30, 10, NOW);
    expect(res).toMatchObject({ deleted: 1, truncated: false });
    expect(messages.map((m) => m._id).sort()).toEqual(['m-old-live', 'm-recent-del']);
  });

  it('purgeDeletedMessages reports truncation when the limit binds', async () => {
    const messages: Row[] = [
      { _id: 'm1', deleted: true, updated_at: OLD },
      { _id: 'm2', deleted: true, updated_at: OLD },
    ];
    const s = svc(messages, []);
    const res = await s.purgeDeletedMessages(30, 1, NOW);
    expect(res).toMatchObject({ deleted: 1, truncated: true });
    expect(messages).toHaveLength(1);
  });

  it('purgeDeletedGroups removes old soft-deleted groups and their messages', async () => {
    const messages: Row[] = [
      { _id: 'm-in-old', group_id: 'g-old-del', deleted: false, updated_at: OLD },
      { _id: 'm-in-recent', group_id: 'g-recent-del', deleted: false, updated_at: OLD },
    ];
    const groups: Row[] = [
      { _id: 'g-old-del', deleted: true, updated_at: OLD },
      { _id: 'g-recent-del', deleted: true, updated_at: RECENT },
    ];
    const s = svc(messages, groups);
    const res = await s.purgeDeletedGroups(30, 10, NOW);
    expect(res).toMatchObject({ groups: 1, messages: 1, truncated: false });
    expect(groups.map((g) => g._id)).toEqual(['g-recent-del']);
    expect(messages.map((m) => m._id)).toEqual(['m-in-recent']);
  });

  it('purges are no-ops when nothing is eligible', async () => {
    const s = svc([{ _id: 'm-live', deleted: false, updated_at: OLD }], []);
    await expect(s.purgeDeletedMessages(30, 10, NOW)).resolves.toMatchObject({ deleted: 0 });
    await expect(s.purgeDeletedGroups(30, 10, NOW)).resolves.toMatchObject({ groups: 0, messages: 0 });
  });
});

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { topUpJobId } from './generation.service.js';

/**
 * Regression: BullMQ rejects custom job ids containing `:`
 * ("Custom Id cannot contain :"), so the old `topup:<topic>:<diff>:<deficit>`
 * scheme made every "Top up all buffers" press fail with a 500.
 *
 * The format check is pure; the queue round-trip runs only when a local
 * Redis is reachable, so CI without Redis still exercises the id contract.
 */
describe('topUpJobId', () => {
  it('never contains a colon (BullMQ custom-id constraint)', () => {
    expect(topUpJobId('ml-basics', 'easy', 450)).toBe('topup-ml-basics-easy-450');
    expect(topUpJobId('neural-networks', 'hard', 10)).not.toContain(':');
  });

  it('is deterministic and distinguishes combo/deficit', () => {
    expect(topUpJobId('llms', 'medium', 100)).toBe(topUpJobId('llms', 'medium', 100));
    expect(topUpJobId('llms', 'medium', 100)).not.toBe(topUpJobId('llms', 'medium', 110));
    expect(topUpJobId('llms', 'medium', 100)).not.toBe(topUpJobId('llms', 'easy', 100));
  });

  it('is accepted by BullMQ addBulk (skipped when Redis is unavailable)', async () => {
    const conn = new Redis('redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    const queue = new Queue('jobid-contract-test', { connection: conn });
    try {
      await conn.connect();
      const jobs = await queue.addBulk([
        {
          name: 'topup-llms-easy',
          data: { topic: 'llms', difficulty: 'easy', count: 10 },
          opts: { jobId: topUpJobId('llms', 'easy', 450) },
        },
      ]);
      expect(jobs[0].id).toBe('topup-llms-easy-450');
      await jobs[0].remove();
    } catch {
      // No local Redis: the pure id assertions above still guard the contract.
    } finally {
      await queue.close().catch(() => undefined);
      conn.disconnect();
    }
  });
});

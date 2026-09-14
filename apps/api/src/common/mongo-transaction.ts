import type { ClientSession, Connection } from 'mongoose';

/**
 * Multi-document writes (attempt + points + streak + question stats) used to
 * be fire-and-forget: a crash or a failed write in the middle left points and
 * streaks permanently out of sync. Wrap them in a Mongo transaction when the
 * deployment supports one (Atlas / replica sets) and fall back to the old
 * sequential behaviour on standalone Mongo (the default local docker-compose
 * setup), so local development keeps working.
 *
 * `withTransaction` may retry the callback on transient errors; keep it
 * idempotent-friendly and free of side effects outside the session.
 */
export function isTransactionUnsupported(err: unknown): boolean {
  const code = (err as { code?: number } | null)?.code;
  if (code === 20 || code === 303) return true; // IllegalOperation / no replset
  const message = err instanceof Error ? err.message : String(err);
  return (
    /Transaction numbers are only allowed/i.test(message) ||
    /replica set member or mongos/i.test(message) ||
    /transactions are not supported/i.test(message)
  );
}

export async function withTransaction<T>(
  connection: Connection,
  fn: (session: ClientSession | null) => Promise<T>,
): Promise<T> {
  let session: ClientSession;
  try {
    session = await connection.startSession();
  } catch {
    return fn(null); // no sessions available (very old server) — best effort
  }
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (isTransactionUnsupported(err)) {
      // Standalone MongoDB: nothing was applied, so a plain retry is safe.
      return fn(null);
    }
    throw err;
  } finally {
    await session.endSession().catch(() => undefined);
  }
}

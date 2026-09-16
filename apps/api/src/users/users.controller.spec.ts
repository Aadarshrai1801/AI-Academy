import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

// The DTO lives in the controller file (same pattern as attempts.controller).
// Importing the controller module pulls @nestjs/common only — no DB, no app.
import { UsersController } from './users.controller.js';

// Reach the non-exported DTO through the method metadata instead of
// restructuring the controller for the test's sake.
const dtoType: new () => Record<string, unknown> = (
  Reflect.getMetadata('design:paramtypes', UsersController.prototype, 'updateMe') as unknown[]
)[1] as new () => Record<string, unknown>;

async function violations(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(dtoType, body);
  // Mirror the global pipe in main.ts: whitelist + forbid-non-whitelisted.
  const errors = await validate(dto as object, { whitelist: true, forbidNonWhitelisted: true });
  return errors.flatMap((v) => Object.values(v.constraints ?? {}));
}

describe('PATCH /users/me body contract', () => {
  it('accepts a valid username', async () => {
    expect(await violations({ username: 'Ada_Lovelace.42' })).toEqual([]);
  });

  it('accepts username plus email', async () => {
    expect(await violations({ username: 'ada-42', email: 'ada@example.com' })).toEqual([]);
  });

  it('rejects short, long and malformed usernames', async () => {
    expect(await violations({ username: 'ab' })).not.toEqual([]);
    expect(await violations({ username: 'a'.repeat(31) })).not.toEqual([]);
    expect(await violations({ username: 'ada lovelace' })).not.toEqual([]);
    expect(await violations({ username: '<script>' })).not.toEqual([]);
    expect(await violations({})).not.toEqual([]);
  });

  it('rejects a malformed email but allows omitting it', async () => {
    expect(await violations({ username: 'ada-42', email: 'not-an-email' })).not.toEqual([]);
    expect(await violations({ username: 'ada-42' })).toEqual([]);
  });

  it('rejects unknown fields (global whitelist is forbid-non-whitelisted)', async () => {
    expect(await violations({ username: 'ada-42', role: 'admin' })).not.toEqual([]);
  });
});

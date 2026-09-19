import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';

/**
 * POST /questions/seed is admin-only in EVERY bank state.
 *
 * The endpoint used to allow any authenticated user to bootstrap an empty
 * bank (only top-ups were admin-gated). AdminGuard now covers both paths;
 * these tests exercise the guard at the HTTP layer so the 403 is proven
 * independently of whatever the service thinks the bank looks like.
 *
 * The `npm run seed` CLI is unaffected: it writes to Mongo directly through
 * mongoose (src/seed.ts) and never calls this route.
 */
async function buildApp(seedImpl: () => Promise<unknown>) {
  const seedIfEmpty = vi.fn(seedImpl);
  const moduleRef = await Test.createTestingModule({
    controllers: [QuestionsController],
    providers: [
      {
        provide: QuestionsService,
        useValue: {
          seedIfEmpty,
          topics: vi.fn(),
          count: vi.fn(),
          next: vi.fn(),
          byId: vi.fn(),
        },
      },
    ],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  // Stand-in for the global Clerk guard: tests set the role via a header.
  app.use((req: any, _res: any, next: any) => {
    req.auth = { userId: 'test-user', role: req.headers['x-test-role'] ?? 'free' };
    next();
  });
  await app.init();
  return { app, seedIfEmpty };
}

describe('POST /questions/seed — admin-only in both bank states', () => {
  it('returns 403 for a free user even when the bank is EMPTY (bootstrap path)', async () => {
    const { app, seedIfEmpty } = await buildApp(async () => ({ inserted: 54, total: 54 }));
    try {
      await request(app.getHttpServer())
        .post('/questions/seed')
        .set('x-test-role', 'free')
        .expect(403);
      expect(seedIfEmpty).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('returns 403 for a pro user even when the bank is NON-EMPTY (top-up path)', async () => {
    const { app, seedIfEmpty } = await buildApp(async () => ({ inserted: 0, total: 54 }));
    try {
      await request(app.getHttpServer())
        .post('/questions/seed')
        .set('x-test-role', 'pro')
        .expect(403);
      expect(seedIfEmpty).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('allows an admin through to the service', async () => {
    const { app, seedIfEmpty } = await buildApp(async () => ({ inserted: 3, total: 57 }));
    try {
      const res = await request(app.getHttpServer())
        .post('/questions/seed')
        .set('x-test-role', 'admin')
        .expect(201);
      expect(res.body).toEqual({ inserted: 3, total: 57 });
      expect(seedIfEmpty).toHaveBeenCalledWith('admin');
    } finally {
      await app.close();
    }
  });
});

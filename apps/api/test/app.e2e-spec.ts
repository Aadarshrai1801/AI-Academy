import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppController } from './../src/app.controller.js';
import { AppService } from './../src/app.service.js';
import { HealthController } from './../src/health/health.controller.js';

/**
 * Boots only the DB-free controllers so the suite runs anywhere (CI has no
 * Mongo/Redis for e2e). The previous version booted AppModule and asserted the
 * stale Nest scaffold response, so `npm run test:e2e` always failed.
 */
describe('app + health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, HealthController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health/live → 200 with version metadata', async () => {
    const res = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('ai-academy-api');
    expect(typeof res.body.version).toBe('string');
  });

  it('/health/ready → 503 when dependencies are unavailable', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.mongo.ok).toBe(false);
  });
});

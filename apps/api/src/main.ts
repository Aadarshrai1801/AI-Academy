import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module.js';
import { assertBootConfig, appVersion, loadEnvFile, nodeEnv } from './config.js';
import { requestIdMiddleware } from './common/request-id.middleware.js';
import { httpLoggerMiddleware } from './common/http-logger.middleware.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';

async function bootstrap() {
  // Load .env first (no-op when the platform injects real env vars) and refuse
  // to start a production process with an incomplete/unsafe configuration.
  loadEnvFile();
  assertBootConfig();

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: nodeEnv(),
      release: appVersion(),
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1) || 0.1,
    });
  }

  // rawBody:true preserves the Stripe webhook raw payload for signature verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  // Behind Render/Vercel/ALB the client IP arrives via X-Forwarded-For.
  // Required for correct per-IP rate limiting (ThrottleGuard uses req.ip).
  // TRUST_PROXY: number of proxy hops (default 1) or an Express trust string
  // (e.g. "loopback" or a comma-separated CIDR list). Behind two hops (CDN +
  // LB) this MUST be 2, or every client shares the outermost proxy IP and the
  // per-IP rate limit collapses into one global bucket.
  const trustProxy = process.env.TRUST_PROXY ?? '1';
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

  // Correlation id + structured error contract on every request.
  app.use(requestIdMiddleware);
  app.use(httpLoggerMiddleware);
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORP must allow cross-origin embedding: the web app (WEBAPP_URL/CORS_ORIGINS)
  // loads mp4s via <video> (no-cors subresource fetch), which same-origin CORP blocks.
  // CORS origins stay allow-listed below, so this doesn't open the API to everyone.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // WEBAPP_URL is the legacy single-origin variable; CORS_ORIGINS wins when set.
  const origins = (process.env.CORS_ORIGINS ?? process.env.WEBAPP_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // reject unknown fields instead of silently dropping them
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  const server = app.getHttpServer();
  // Enterprise graceful drain: stop accepting new connections on SIGTERM,
  // give in-flight requests 10s, then let enableShutdownHooks close Nest.
  const shutdown = () => {
    try {
      server.close(() => process.exit(0));
    } catch {
      process.exit(0);
    }
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  new Logger('Bootstrap').log(`ai-academy-api listening on :${port} (${nodeEnv()}, ${appVersion()})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[bootstrap] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

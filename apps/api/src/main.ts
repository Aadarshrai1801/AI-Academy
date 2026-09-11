import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module.js';

async function bootstrap() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  }

  // rawBody:true preserves the Stripe webhook raw payload for signature verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // CORP must allow cross-origin embedding: the web app (WEBAPP_URL/CORS_ORIGINS)
  // loads mp4s via <video> (no-cors subresource fetch), which same-origin CORP blocks.
  // CORS origins stay allow-listed below, so this doesn't open the API to everyone.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[ai-academy-api] Phase 1 listening on :${port}`);
}

await bootstrap();

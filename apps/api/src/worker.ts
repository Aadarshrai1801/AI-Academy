import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from './common/redis.module.js';
import { LlmModule } from './llm/llm.module.js';
import { GenerationModule } from './generation/generation.module.js';

/**
 * Standalone worker entry: `npm run build && node dist/worker`
 * (spec §4: BullMQ on worker dynos). Shares the queue with the API —
 * run alongside `node dist/main`, or set GENERATION_WORKER=false on the API
 * and scale this process independently.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/hoopr'),
    RedisModule,
    LlmModule,
    GenerationModule,
  ],
})
class WorkerAppModule {}

async function bootstrap() {
  // Force worker mode even if API default changes.
  process.env.GENERATION_WORKER ??= 'true';
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  // eslint-disable-next-line no-console
  console.log('[worker] question-gen worker running (Ctrl-C to stop)');
  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

await bootstrap();

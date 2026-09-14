import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from './common/common.module.js';
import { LlmModule } from './llm/llm.module.js';
import { GenerationModule } from './generation/generation.module.js';
import { VideoModule } from './video/video.module.js';
import { CallsModule } from './calls/calls.module.js';
import { assertBootConfig, loadEnvFile } from './config.js';

/**
 * Standalone worker entry: `npm run build && node dist/worker`
 * (spec §4: BullMQ on worker dynos). Shares the queues with the API —
 * run alongside `node dist/main`, or set GENERATION_WORKER/VIDEO_WORKER/
 * CALL_WORKER=false on the API and scale this process independently.
 *
 * This process hosts ALL queues (question generation, video rendering, call
 * timers). Previously it only wired GenerationModule, so `node dist/worker`
 * silently left video renders and call timers unprocessed.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/aiacademy'),
    CommonModule,
    LlmModule,
    GenerationModule,
    VideoModule,
    CallsModule,
  ],
})
class WorkerAppModule {}

async function bootstrap() {
  loadEnvFile();
  assertBootConfig();
  // Force worker mode even if the API default changes.
  process.env.GENERATION_WORKER ??= 'true';
  process.env.VIDEO_WORKER ??= 'true';
  process.env.CALL_WORKER ??= 'true';
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  const log = new Logger('Worker');
  log.log('queues: question-gen + video-render + call-timers (Ctrl-C to stop)');
  const shutdown = async (signal: string) => {
    log.log(`${signal} received — draining and closing`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

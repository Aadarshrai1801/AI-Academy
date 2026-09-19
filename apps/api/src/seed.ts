/**
 * Standalone seed runner: `npm run seed` (spec §7 Phase 1 seeded bank).
 * Idempotent — inserts only prompts not already present.
 * Uses a plain mongoose schema (no Nest decorators: tsx/esbuild cannot emit
 * decorator metadata, so Nest schemas can't be imported here).
 * Run: MONGODB_URI=mongodb://localhost:27017/aiacademy npm run seed
 *
 * Safety: refuses to write to a non-local URI (or NODE_ENV=production) unless
 * `CONFIRM_SEED=yes` is set, so a stray local run cannot touch a live cluster.
 */
import mongoose from 'mongoose';
import { loadEnvFile } from './config.js';
import { SEED_QUESTIONS } from './questions/seed.data.js';

loadEnvFile();

const SeedQuestionSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, index: true },
    subtopic: String,
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true, index: true },
    type: { type: String, enum: ['mcq', 'short_answer', 'code'], required: true },
    prompt: { type: String, required: true },
    options: [String],
    correct_answer: { type: String, required: true },
    explanation: { type: String, required: true },
    source: { type: String, default: 'seed' },
    quality_status: { type: String, default: 'approved', index: true },
    times_served: { type: Number, default: 0 },
    times_correct: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/aiacademy';

  // Safety: seeding writes to whatever MONGODB_URI points at. Anything that is
  // not a local database (or is explicitly NODE_ENV=production) needs an
  // explicit confirmation so a stray `npm run seed` can never touch a live
  // cluster (mirrors promote.ts's CONFIRM_PROMOTE pattern).
  let host = '';
  let isLocal = false;
  try {
    const u = new URL(uri);
    host = u.hostname;
    isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) || host.endsWith('.local');
  } catch {
    /* unparseable URI — connect will surface the real error */
  }
  const needsConfirmation = process.env.NODE_ENV === 'production' || !isLocal;
  if (needsConfirmation && process.env.CONFIRM_SEED !== 'yes') {
    // eslint-disable-next-line no-console
    console.error(
      `[seed] Refusing to seed ${host || 'the configured database'} without confirmation.\n` +
        '  Target is not local (or NODE_ENV=production).\n' +
        '  Re-run with CONFIRM_SEED=yes if you really mean to write to this database.',
    );
    process.exit(1);
  }
  // Safe target line (credentials stripped) so operators can see where data lands.
  // eslint-disable-next-line no-console
  console.log(`[seed] target=${host || uri.replace(/\/\/[^@/]*@/, '//')}`);

  await mongoose.connect(uri);
  const Question = mongoose.models.Question ?? mongoose.model('Question', SeedQuestionSchema);

  const existing = new Set(
    (await Question.find({}).select('prompt').lean().exec()).map(
      (q) => (q as { prompt: string }).prompt,
    ),
  );
  const fresh = SEED_QUESTIONS.filter((q) => !existing.has(q.prompt));
  if (fresh.length > 0) {
    await Question.insertMany(
      fresh.map((q) => ({ ...q, source: 'seed', quality_status: 'approved' })),
      { ordered: false },
    );
  }
  const total = await Question.countDocuments().exec();
  // eslint-disable-next-line no-console
  console.log(`[seed] inserted=${fresh.length} total=${total}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed:', err);
  process.exit(1);
});

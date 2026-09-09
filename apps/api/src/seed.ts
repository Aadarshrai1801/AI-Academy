/**
 * Standalone seed runner: `npm run seed` (spec §7 Phase 1 seeded bank).
 * Idempotent — inserts only prompts not already present.
 * Uses a plain mongoose schema (no Nest decorators: tsx/esbuild cannot emit
 * decorator metadata, so Nest schemas can't be imported here).
 * Run: MONGODB_URI=mongodb://localhost:27017/hoopr npm run seed
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { SEED_QUESTIONS } from './questions/seed.data.js';

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
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/hoopr';
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

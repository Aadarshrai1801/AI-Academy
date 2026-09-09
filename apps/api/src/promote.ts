/**
 * Role management: `npm run promote -- <clerkId> [free|pro|admin]`
 * Plain mongoose (no Nest decorators — tsx-safe, like seed.ts).
 */
import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
  const [clerkId, role = 'admin'] = process.argv.slice(2);
  if (!clerkId || !['free', 'pro', 'admin'].includes(role)) {
    // eslint-disable-next-line no-console
    console.error('Usage: npm run promote -- <clerkId> [free|pro|admin]');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/hoopr';
  await mongoose.connect(uri);
  const User = mongoose.models.User ?? mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const res = await User.findOneAndUpdate({ clerkId }, { role }, { new: true }).lean().exec();
  // eslint-disable-next-line no-console
  console.log(res ? `[promote] ${clerkId} → ${role}` : `[promote] user not found: ${clerkId}`);
  await mongoose.disconnect();
  if (!res) process.exit(1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[promote] failed:', err);
  process.exit(1);
});

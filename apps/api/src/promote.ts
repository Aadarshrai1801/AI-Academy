/**
 * Role management: `npm run promote -- <clerkId> [free|pro|admin]`
 * Plain mongoose (no Nest decorators — tsx-safe, like seed.ts).
 *
 * Production guard: promoting in production requires an explicit confirmation
 * (`CONFIRM_PROMOTE=<clerkId>`) so a stray shell command cannot silently grant
 * admin rights. Use the audited `POST /admin/users/:clerkId/role` API instead
 * whenever possible — this CLI writes no audit entry.
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
  if (process.env.NODE_ENV === 'production' && process.env.CONFIRM_PROMOTE !== clerkId) {
    // eslint-disable-next-line no-console
    console.error(
      `[promote] Refusing to change roles in production without confirmation.\n` +
        `  Re-run with CONFIRM_PROMOTE=${clerkId} (or use the audited admin API).`,
    );
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/aiacademy';
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

#!/usr/bin/env node
/**
 * Dependency-free secret scanner.
 *
 * Why: GitHub secret scanning / gitleaks / TruffleHog may not be enabled on
 * every plan, fork, or self-hosted runner. This script has zero dependencies
 * and fails CI when a likely credential is committed to a tracked file.
 *
 * Usage:
 *   node scripts/check-secrets.mjs              # scan tracked files (CI)
 *   node scripts/check-secrets.mjs --history    # scan every commit diff too
 *
 * Exit code 1 when a likely credential is found. Documented placeholders
 * (change-me, <...>, ..., example) are ignored so `.env.example` files and
 * docs stay usable.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const HIGH_SIGNAL = [
  { name: 'Stripe live secret key', re: /\bsk_live_[0-9a-zA-Z]{16,}/ },
  { name: 'Stripe test secret key', re: /\bsk_test_[0-9a-zA-Z]{16,}/ },
  { name: 'Stripe restricted key', re: /\brk_(live|test)_[0-9a-zA-Z]{16,}/ },
  { name: 'Stripe webhook secret', re: /\bwhsec_[0-9a-zA-Z]{16,}/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Groq API key', re: /\bgsk_[A-Za-z0-9]{20,}\b/ },
  { name: 'Clerk secret key', re: /\bsk_(live|test)_[A-Za-z0-9]{20,}/ },
  { name: 'Ably API key', re: /\b[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{6}:[A-Za-z0-9_-]{20,}/ },
  { name: 'MongoDB URI with credentials', re: /mongodb(\+srv)?:\/\/[^/\s:]+:[^/\s@]+@[^\s'"]+/ },
  { name: 'Redis URL with credentials', re: /rediss?:\/\/[^/\s:]+:[^/\s@]+@[^\s'"]+/ },
  { name: 'LiveKit secret', re: /\bLIVEKIT_API_SECRET\s*=\s*['"]?[^'"\s]{16,}/ },
  { name: 'ElevenLabs API key', re: /\bELEVENLABS_API_KEY\s*=\s*['"]?sk_[A-Za-z0-9]{20,}['"]?/ },
  { name: 'RealtimeKit API token', re: /\bRTK_API_TOKEN\s*=\s*['"]?cfut_[A-Za-z0-9_-]{10,}['"]?/ },
  { name: 'R2 secret access key', re: /\bR2_SECRET_ACCESS_KEY\s*=\s*['"]?[^'"\s]{16,}['"]?/ },
  { name: 'R2 access key id', re: /\bR2_ACCESS_KEY_ID\s*=\s*['"]?[A-Za-z0-9]{16,}['"]?/ },
  { name: 'Video signing secret (hex)', re: /\bVIDEO_SECRET\s*=\s*['"]?[A-Fa-f0-9]{32,}['"]?/ },
  { name: 'Upstash REST token', re: /\bUPSTASH_REDIS_REST_TOKEN\s*=\s*['"]?[A-Za-z0-9_-]{20,}['"]?/ },
  { name: 'Stripe publishable key', re: /\bpk_(live|test)_[0-9a-zA-Z]{16,}/ },
  { name: 'Generic private key / token assignment', re: /(API_KEY|API_SECRET|SECRET_KEY|WEBHOOK_SECRET)\s*=\s*['"]?[A-Za-z0-9_\-]{24,}['"]?/ },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
];

// Lines that clearly carry an example/placeholder rather than a live value.
const PLACEHOLDER = /(change[-_]?me|replace[-_]?me|your[-_]|example|placeholder|dummy|fake|xxxx+|user:pass|cluster\.|localhost|<[^>\s]+>|\.\.\.|\[[A-Z ]+\])/i;

const findings = [];

function scanText(text, label) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (PLACEHOLDER.test(line)) continue;
    for (const { name, re } of HIGH_SIGNAL) {
      const match = line.match(re);
      if (match) {
        findings.push({
          label,
          line: i + 1,
          name,
          sample: `${match[0].slice(0, 10)}…`,
        });
      }
    }
  }
}

const historyMode = process.argv.includes('--history');

if (historyMode) {
  // Full history scan is for local runs after cloning; CI checkouts are shallow.
  const diff = execFileSync('git', ['log', '-p', '--all', '--no-color'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  scanText(diff, 'git history');
} else {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  for (const file of files) {
    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      continue; // deleted-but-listed edge case
    }
    if (buf.includes(0)) continue; // binary
    scanText(buf.toString('utf8'), file);
  }
}

if (findings.length === 0) {
  console.log(`ok — no high-signal credentials found (${historyMode ? 'git history' : 'tracked files'})`);
  process.exit(0);
}

console.error(`found ${findings.length} potential secret(s):`);
for (const f of findings) {
  console.error(`  - ${f.label}:${f.line}  ${f.name}  (${f.sample})`);
}
console.error('\nRemove the value, rotate the credential, and purge it from history if it was pushed.');
process.exit(1);

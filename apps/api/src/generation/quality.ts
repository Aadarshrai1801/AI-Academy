import { GeneratedQuestion } from '../llm/llm.provider.js';

/**
 * Automated quality + duplicate checks (spec §2.1: every generation passes
 * automated review before entering the pool; low-confidence items route to
 * the admin queue instead of being silently dropped).
 * Pure functions — unit-tested, no DB/LLM dependencies.
 */

export const normalize = (s: unknown) =>
  String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const tokens = (s: string) => new Set(normalize(s).split(' ').filter(Boolean));

/** Token-set Jaccard similarity 0..1 (offline stand-in for embedding cosine). */
export function jaccard(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface QualityVerdict {
  ok: boolean;
  score: number; // 0..1 confidence
  reasons: string[];
}

export function qualityCheck(q: GeneratedQuestion): QualityVerdict {
  const reasons: string[] = [];

  if (!q || typeof q !== 'object') return { ok: false, score: 0, reasons: ['not an object'] };
  if (!q.prompt || normalize(q.prompt).length < 20) reasons.push('prompt too short/generic');
  if (!q.explanation || normalize(q.explanation).length < 20) reasons.push('explanation too short');
  if (q.correct_answer == null || !String(q.correct_answer).trim()) reasons.push('missing correct_answer');
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) reasons.push('invalid difficulty');
  if (!['mcq', 'short_answer', 'code'].includes(q.type)) reasons.push('invalid type');

  if (q.type === 'mcq') {
    const opts = (q.options ?? []).map((o) => normalize(o)).filter(Boolean);
    if (opts.length < 3) reasons.push('mcq needs ≥3 options');
    if (new Set(opts).size !== opts.length) reasons.push('duplicate options');
    if (!opts.includes(normalize(q.correct_answer))) reasons.push('answer not among options');
  } else if (q.correct_answer != null && String(q.correct_answer).trim().length > 300) {
    reasons.push('open answer implausibly long');
  }

  return { ok: reasons.length === 0, score: Math.max(0, 1 - 0.25 * reasons.length), reasons };
}

/** True when candidate is an exact or near-duplicate of any existing prompt. */
export function isDuplicate(candidate: string, existingPrompts: string[], threshold = 0.85): boolean {
  const norm = normalize(candidate);
  for (const p of existingPrompts) {
    const np = normalize(p);
    if (np === norm) return true;
    if (jaccard(norm, np) >= threshold) return true;
  }
  return false;
}

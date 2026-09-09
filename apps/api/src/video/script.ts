/**
 * Explainer script model + pure helpers (spec §5: structured slides+TTS pipeline).
 * A script is 1 title + up to 5 scenes; each scene renders as one slide with
 * burned-in narration timing. Pure functions — unit-tested.
 */
export interface ScriptScene {
  heading: string;
  bullets: string[];
  narration: string;
  durationSec: number;
}

export interface ExplainerScript {
  title: string;
  scenes: ScriptScene[];
}

export const WORDS_PER_MINUTE = 150;
export const MIN_SCENE_SEC = 4;
export const MAX_SCENE_SEC = 20;
export const MAX_SCENES = 5;

/** Narration-paced slide duration from word count. */
export function narrationDuration(narration: string): number {
  const words = narration.split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_SCENE_SEC, Math.max(MIN_SCENE_SEC, (words / WORDS_PER_MINUTE) * 60 + 1));
}

export function totalDuration(script: ExplainerScript): number {
  return script.scenes.reduce((s, sc) => s + sc.durationSec, 0);
}

const truncate = (s: string, n: number) =>
  s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';

/**
 * Dev-stub script builder: splits a text answer into narrated scenes.
 * Real provider (Anthropic) writes bespoke scripts; this keeps the pipeline
 * fully exercisable without a key.
 */
export function splitAnswerToScenes(question: string, answer: string): ExplainerScript {
  const plain = answer.replace(/[-*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  const sentences = plain.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const perScene = 3;
  const scenes: ScriptScene[] = [];
  for (let i = 0; i < sentences.length && scenes.length < MAX_SCENES; i += perScene) {
    const chunk = sentences.slice(i, i + perScene);
    const narration = chunk.join(' ');
    const heading = truncate(chunk[0].split(' ').slice(0, 7).join(' '), 60);
    scenes.push({
      heading,
      bullets: chunk.slice(0, 3).map((s) => truncate(s, 70)),
      narration,
      durationSec: narrationDuration(narration),
    });
  }
  if (scenes.length === 0) {
    scenes.push({
      heading: truncate(question, 60),
      bullets: [truncate(plain, 70)],
      narration: plain || question,
      durationSec: narrationDuration(plain || question),
    });
  }
  return { title: truncate(question, 80), scenes };
}

/** Escape user text for ffmpeg drawtext (backslash, colon, quote, percent). */
export function escapeDrawtext(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/%/g, '\\%');
}

/** Escape a Windows font path for ffmpeg filter args (C:\ → C\:/). */
export function escapeFontPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

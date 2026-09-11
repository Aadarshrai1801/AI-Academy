import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * TTS abstraction (spec §5: narration for explainer videos).
 * - With ELEVENLABS_API_KEY set → ElevenLabsTts (real speech, ffprobe-paced).
 * - Without → NoopTts (word-count pacing, renderer muxes silence).
 * Any TTS failure fails OPEN to silence pacing so renders never break.
 * The swap is one factory branch (selectTts); the pipeline never changes.
 */
export interface NarrationTrack {
  /** Null when using synthesized silence (dev mode). */
  audioPath: string | null;
  durationSec: number;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(narration: string): Promise<NarrationTrack>;
}

export const TTS_PROVIDER = 'TTS_PROVIDER';

const exec = promisify(execFile);
const WPM = 150;
/** Spec §5: narration is capped so per-character TTS spend stays bounded. */
const MAX_CHARS = 600;

/** Word-count pacing fallback (also what NoopTts uses). */
export function pacedDuration(narration: string): number {
  const words = narration.split(/\s+/).filter(Boolean).length;
  return Math.min(20, Math.max(4, (words / WPM) * 60 + 1));
}

export class NoopTts implements TtsProvider {
  readonly name = 'noop-silence-v1';
  async synthesize(narration: string): Promise<NarrationTrack> {
    return { audioPath: null, durationSec: pacedDuration(narration) };
  }
}

/**
 * ElevenLabs speech (opt-in). Needs:
 *   ELEVENLABS_API_KEY=xi_... (required)
 *   ELEVENLABS_VOICE_ID=…     (default: Rachel — multilingual v2 friendly)
 *   ELEVENLABS_MODEL=…        (default: eleven_turbo_v2_5 — cheapest/fastest)
 * Audio is cached by text hash under storage/tmp/tts so repeat scenes are
 * free. Duration comes from ffprobe (falls back to word-count pacing).
 * NEVER throws — any failure degrades to silence pacing.
 */
export class ElevenLabsTts implements TtsProvider {
  readonly name = 'elevenlabs-v1';

  constructor(
    private readonly apiKey: string,
    private readonly voiceId = '21m00Tcm4TlvDq8ikWAM',
    private readonly model = 'eleven_turbo_v2_5',
    // Ephemeral OS tmp (cloud disks are wiped on redeploy; this is a pure
    // cost cache — misses just re-call ElevenLabs). Override with TTS_CACHE_DIR.
    private readonly dir = process.env.TTS_CACHE_DIR ?? join(tmpdir(), 'ai-academy-tts'),
  ) {}

  async synthesize(narration: string): Promise<NarrationTrack> {
    const text = narration.trim().slice(0, MAX_CHARS);
    if (!text) return { audioPath: null, durationSec: pacedDuration(narration) };
    try {
      await fs.mkdir(this.dir, { recursive: true });
      const file = join(this.dir, `${createHash('sha256').update(text).digest('hex').slice(0, 16)}.mp3`);
      try {
        const st = await fs.stat(file);
        if (st.size > 0) return { audioPath: file, durationSec: await this.probe(file, text) };
      } catch {
        // cache miss — synthesize below
      }
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: this.model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (!res.ok) throw new Error(`elevenlabs HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) throw new Error('elevenlabs returned empty audio');
      await fs.writeFile(file, buf);
      return { audioPath: file, durationSec: await this.probe(file, text) };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[tts] elevenlabs failed, using silence pacing:', (err as Error).message);
      return { audioPath: null, durationSec: pacedDuration(narration) };
    }
  }

  private async probe(file: string, text: string): Promise<number> {
    try {
      const { stdout } = await exec(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file],
        { timeout: 15000 },
      );
      const d = Number(String(stdout).trim());
      if (Number.isFinite(d) && d > 0) return Math.min(60, Math.max(2, d + 0.4));
    } catch {
      // fall through to pacing
    }
    return pacedDuration(text);
  }
}

/** Factory branch used by VideoModule — env only, no code changes. */
export function selectTts(): TtsProvider {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new NoopTts();
  return new ElevenLabsTts(
    key,
    process.env.ELEVENLABS_VOICE_ID || undefined,
    process.env.ELEVENLABS_MODEL || undefined,
  );
}

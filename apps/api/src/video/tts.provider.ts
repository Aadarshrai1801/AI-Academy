/**
 * TTS abstraction (spec §5: narration for explainer videos).
 * Real speech needs ELEVENLABS_API_KEY (or OpenAI TTS) — until then NoopTts
 * paces slides from narration word count and the renderer muxes silence.
 * The swap is one factory branch; the pipeline never changes.
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

const WPM = 150;

export class NoopTts implements TtsProvider {
  readonly name = 'noop-silence-v1';
  async synthesize(narration: string): Promise<NarrationTrack> {
    const words = narration.split(/\s+/).filter(Boolean).length;
    return {
      audioPath: null,
      durationSec: Math.min(20, Math.max(4, (words / WPM) * 60 + 1)),
    };
  }
}

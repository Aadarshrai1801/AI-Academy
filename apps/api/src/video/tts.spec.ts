import { ElevenLabsTts, NoopTts, pacedDuration, selectTts } from './tts.provider.js';

describe('tts providers', () => {
  it('paces silence within bounds', async () => {
    const tts = new NoopTts();
    const short = await tts.synthesize('one two three');
    expect(short.audioPath).toBeNull();
    expect(short.durationSec).toBe(4); // floor
    const long = await tts.synthesize(Array.from({ length: 600 }, () => 'word').join(' '));
    expect(long.durationSec).toBe(20); // ceiling
    expect(pacedDuration('hello world')).toBeGreaterThanOrEqual(4);
  });

  it('selects provider from env only', () => {
    const saved = process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    expect(selectTts().name).toBe('noop-silence-v1');
    process.env.ELEVENLABS_API_KEY = 'xi_test_key';
    expect(selectTts().name).toBe('elevenlabs-v1');
    if (saved === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = saved;
  });

  it('elevenlabs fails open to silence pacing when the API rejects', async () => {
    const realFetch = globalThis.fetch;
    // @ts-expect-error — minimal stub: 401 immediately, no network
    globalThis.fetch = async () => ({ ok: false, status: 401, arrayBuffer: async () => new ArrayBuffer(0) });
    try {
      const tts = new ElevenLabsTts('xi_bad_key');
      const track = await tts.synthesize('Backpropagation applies the chain rule layer by layer.');
      expect(track.audioPath).toBeNull();
      expect(track.durationSec).toBeGreaterThanOrEqual(4);
      expect(track.durationSec).toBeLessThanOrEqual(20);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

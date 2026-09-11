import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { ExplainerScript, escapeDrawtext, escapeFontPath } from './script.js';

const exec = promisify(execFile);
const WIDTH = 1280;
const HEIGHT = 720;
const BG = '0x14141f';

/**
 * Font resolution order: explicit env → common Linux (Render/Railway/Docker)
 * → Windows dev machine. Cloud hosts have no C:/Windows/Fonts, so the old
 * hardcoded paths made every render fail in production with a cryptic
 * ffmpeg drawtext error.
 */
const TITLE_CANDIDATES = [
  process.env.VIDEO_TITLE_FONT,
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  'C:/Windows/Fonts/arialbd.ttf',
].filter((p): p is string => Boolean(p));
const BODY_CANDIDATES = [
  process.env.VIDEO_BODY_FONT,
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  'C:/Windows/Fonts/arial.ttf',
].filter((p): p is string => Boolean(p));

function pickFont(candidates: string[], label: string): string {
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(
      `[video] no ${label} font found (tried ${candidates.join(', ')}). ` +
        'Set VIDEO_TITLE_FONT / VIDEO_BODY_FONT to a .ttf on the host.',
    );
  }
  return hit;
}

const truncate = (s: string, n: number) =>
  s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';

/**
 * Local ffmpeg slideshow renderer (spec §5 structured pipeline, no-Remotion MVP).
 * Each scene → PNG slide (title + bullets via drawtext) → concat → H.264 mp4.
 * Audio: concatenated per-scene TTS narration when provided, else a silent
 * track (NoopTts dev mode). `-shortest` absorbs any A/V drift.
 * Upgrade path: Remotion for motion graphics; this keeps zero-cost local renders.
 */
export class FfmpegRenderer {
  readonly name = 'ffmpeg-slideshow-v1';
  private bin = process.env.FFMPEG_PATH ?? 'ffmpeg';
  // Resolved lazily in render() so a missing font breaks renders (clear error),
  // never API boot.
  private fonts(): { titleFont: string; bodyFont: string } {
    return {
      titleFont: escapeFontPath(pickFont(TITLE_CANDIDATES, 'title')),
      bodyFont: escapeFontPath(pickFont(BODY_CANDIDATES, 'body')),
    };
  }

  async available(): Promise<boolean> {
    try {
      await exec(this.bin, ['-version'], { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  async render(
    script: ExplainerScript,
    workdir: string,
    outPath: string,
    audioPaths: Array<string | null> = [],
  ): Promise<{ durationSec: number }> {
    const { titleFont, bodyFont } = this.fonts();
    await fs.mkdir(workdir, { recursive: true });
    const scenes = script.scenes.slice(0, 5);
    const list: string[] = [];
    let total = 0;

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const dur = sc.durationSec;
      total += dur;
      const png = join(workdir, `scene${i}.png`);
      await exec(
        this.bin,
        [
          '-y', '-f', 'lavfi',
          '-i', `color=c=${BG}:s=${WIDTH}x${HEIGHT}:d=${dur}`,
          '-vf', this.slideFilter(script.title, sc.heading, sc.bullets, i + 1, scenes.length, titleFont, bodyFont),
          '-frames:v', '1', png,
        ],
        { timeout: 60000 },
      );
      list.push(`file '${png.replace(/'/g, "'\\''")}'\nduration ${dur}`);
    }

    const listPath = join(workdir, 'slides.txt');
    await fs.writeFile(listPath, list.join('\n') + '\n');
    const videoOnly = join(workdir, 'video-only.mp4');
    await exec(
      this.bin,
      [
        '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30',
        '-c:a', 'aac', '-shortest', videoOnly,
      ],
      { timeout: 180000 },
    );
    const narration = audioPaths.filter((a): a is string => Boolean(a));
    if (narration.length === 0) {
      await fs.rename(videoOnly, outPath);
    } else {
      const audioList = join(workdir, 'audio.txt');
      await fs.writeFile(
        audioList,
        narration.map((a) => `file '${a.replace(/'/g, "'\\''")}'`).join('\n') + '\n',
      );
      const narrationTrack = join(workdir, 'narration.m4a');
      await exec(
        this.bin,
        ['-y', '-f', 'concat', '-safe', '0', '-i', audioList, '-c:a', 'aac', narrationTrack],
        { timeout: 120000 },
      );
      await exec(
        this.bin,
        ['-y', '-i', videoOnly, '-i', narrationTrack, '-c:v', 'copy', '-c:a', 'aac', '-shortest', outPath],
        { timeout: 120000 },
      );
    }
    return { durationSec: Math.round(total) };
  }

  private slideFilter(
    title: string,
    heading: string,
    bullets: string[],
    part: number,
    of: number,
    titleFont: string,
    bodyFont: string,
  ): string {
    const t = escapeDrawtext(truncate(title, 64));
    const h = escapeDrawtext(truncate(heading, 56));
    const filters = [
      `drawtext=fontfile='${titleFont}':text='${t}':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=64`,
      `drawtext=fontfile='${bodyFont}':text='${h}':fontsize=52:fontcolor=0x7DD3FC:x=120:y=150`,
      `drawtext=fontfile='${bodyFont}':text='Part ${part}/${of}':fontsize=26:fontcolor=0x71717A:x=w-text_w-60:y=64`,
    ];
    bullets.slice(0, 3).forEach((b, i) => {
      filters.push(
        `drawtext=fontfile='${bodyFont}':text='• ${escapeDrawtext(truncate(b, 52))}':fontsize=32:fontcolor=0xE4E4E7:x=140:y=${300 + i * 84}`,
      );
    });
    return filters.join(',');
  }
}

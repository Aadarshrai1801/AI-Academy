import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ExplainerScript, escapeDrawtext, escapeFontPath } from './script.js';

const exec = promisify(execFile);
const WIDTH = 1280;
const HEIGHT = 720;
const BG = '0x14141f';
const TITLE_FONT = 'C:/Windows/Fonts/arialbd.ttf';
const BODY_FONT = 'C:/Windows/Fonts/arial.ttf';

const truncate = (s: string, n: number) =>
  s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';

/**
 * Local ffmpeg slideshow renderer (spec §5 structured pipeline, no-Remotion MVP).
 * Each scene → PNG slide (title + bullets via drawtext) → concat → H.264 mp4
 * with a silent audio track (real TTS narration swaps in via TtsProvider).
 * Upgrade path: Remotion for motion graphics; this keeps zero-cost local renders.
 */
export class FfmpegRenderer {
  readonly name = 'ffmpeg-slideshow-v1';
  private bin = process.env.FFMPEG_PATH ?? 'ffmpeg';
  private titleFont = escapeFontPath(process.env.VIDEO_TITLE_FONT ?? TITLE_FONT);
  private bodyFont = escapeFontPath(process.env.VIDEO_BODY_FONT ?? BODY_FONT);

  async available(): Promise<boolean> {
    try {
      await exec(this.bin, ['-version'], { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  async render(script: ExplainerScript, workdir: string, outPath: string): Promise<{ durationSec: number }> {
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
          '-vf', this.slideFilter(script.title, sc.heading, sc.bullets, i + 1, scenes.length),
          '-frames:v', '1', png,
        ],
        { timeout: 60000 },
      );
      list.push(`file '${png.replace(/'/g, "'\\''")}'\nduration ${dur}`);
    }

    const listPath = join(workdir, 'slides.txt');
    await fs.writeFile(listPath, list.join('\n') + '\n');
    await exec(
      this.bin,
      [
        '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30',
        '-c:a', 'aac', '-shortest', outPath,
      ],
      { timeout: 180000 },
    );
    return { durationSec: Math.round(total) };
  }

  private slideFilter(title: string, heading: string, bullets: string[], part: number, of: number): string {
    const t = escapeDrawtext(truncate(title, 64));
    const h = escapeDrawtext(truncate(heading, 56));
    const filters = [
      `drawtext=fontfile='${this.titleFont}':text='${t}':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=64`,
      `drawtext=fontfile='${this.bodyFont}':text='${h}':fontsize=52:fontcolor=0x7DD3FC:x=120:y=150`,
      `drawtext=fontfile='${this.bodyFont}':text='Part ${part}/${of}':fontsize=26:fontcolor=0x71717A:x=w-text_w-60:y=64`,
    ];
    bullets.slice(0, 3).forEach((b, i) => {
      filters.push(
        `drawtext=fontfile='${this.bodyFont}':text='• ${escapeDrawtext(truncate(b, 52))}':fontsize=32:fontcolor=0xE4E4E7:x=140:y=${300 + i * 84}`,
      );
    });
    return filters.join(',');
  }
}

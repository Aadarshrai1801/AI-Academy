/**
 * One-off generator for the raster app icons.
 *
 * The mark is two rounded-cap strokes on a rounded gradient tile — simple
 * enough to rasterise analytically, which avoids adding an image library (or
 * `sharp`) just to produce two small files. Geometry mirrors `src/app/icon.svg`
 * at a 32-unit scale and is supersampled 4x4 for clean edges.
 *
 * Usage: node scripts/generate-icons.mjs
 * Writes: src/app/favicon.ico (16/32/48) and src/app/apple-icon.png (180).
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..", "src", "app");

// ── geometry (in 32-unit space, matching icon.svg) ──────────────────────────
const TILE = 32;
const RADIUS = 7.5;
const STROKE = 3.2;
const SEGMENTS = [
  [
    [11, 22.4],
    [15.6, 9.6],
  ],
  [
    [17.4, 22.4],
    [22, 9.6],
  ],
];
const INK = [42, 16, 3];
const GRADIENT = [
  [249, 115, 22],
  [194, 65, 12],
];

const lerp = (a, b, t) => a + (b - a) * t;

/** Signed distance from a point to a rounded rectangle centred in the tile. */
function roundedRectDistance(x, y) {
  const inset = 0;
  const halfW = TILE / 2 - inset;
  const halfH = TILE / 2 - inset;
  const qx = Math.abs(x - TILE / 2) - (halfW - RADIUS);
  const qy = Math.abs(y - TILE / 2) - (halfH - RADIUS);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - RADIUS;
}

/** Distance from a point to a line segment. */
function segmentDistance(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** RGBA for a single sample point, in 32-unit space. */
function sample(x, y) {
  if (roundedRectDistance(x, y) > 0) return [0, 0, 0, 0];

  // Vertical gradient across the tile.
  const t = Math.max(0, Math.min(1, y / TILE));
  let rgb = [
    Math.round(lerp(GRADIENT[0][0], GRADIENT[1][0], t)),
    Math.round(lerp(GRADIENT[0][1], GRADIENT[1][1], t)),
    Math.round(lerp(GRADIENT[0][2], GRADIENT[1][2], t)),
  ];

  const inkDistance = Math.min(...SEGMENTS.map((s) => segmentDistance(x, y, s[0], s[1])));
  if (inkDistance <= STROKE / 2) rgb = INK;

  return [...rgb, 255];
}

/** Supersampled RGBA buffer at the requested pixel size. */
function render(size, samples = 4) {
  const pixels = Buffer.alloc(size * size * 4);
  const step = 1 / samples;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = ((px + (sx + 0.5) * step) / size) * TILE;
          const y = ((py + (sy + 0.5) * step) / size) * TILE;
          const [sr, sg, sb, sa] = sample(x, y);
          const alpha = sa / 255;
          r += sr * alpha;
          g += sg * alpha;
          b += sb * alpha;
          a += sa;
        }
      }
      const total = samples * samples;
      const alphaAverage = a / total;
      const offset = (py * size + px) * 4;
      const weight = alphaAverage > 0 ? a / 255 : 1;
      pixels[offset] = Math.round(r / weight);
      pixels[offset + 1] = Math.round(g / weight);
      pixels[offset + 2] = Math.round(b / weight);
      pixels[offset + 3] = Math.round(alphaAverage);
    }
  }
  return pixels;
}

// ── PNG encoder (RGB + alpha, no interlacing) ───────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  // Raw scanlines, each prefixed with filter type 0.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── ICO container (PNG payloads are valid since Vista) ──────────────────────
function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // icon type
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach((entry, index) => {
    const base = index * 16;
    directory[base] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 1] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 2] = 0; // palette
    directory[base + 3] = 0;
    directory.writeUInt16LE(1, base + 4); // colour planes
    directory.writeUInt16LE(32, base + 6); // bits per pixel
    directory.writeUInt32LE(entry.png.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)]);
}

// ── output ──────────────────────────────────────────────────────────────────
const icoSizes = [16, 32, 48];
const icoEntries = icoSizes.map((size) => ({ size, png: encodePng(size, render(size)) }));
writeFileSync(join(appDir, "favicon.ico"), encodeIco(icoEntries));

const appleSize = 180;
writeFileSync(join(appDir, "apple-icon.png"), encodePng(appleSize, render(appleSize)));

console.log(`favicon.ico  ${icoSizes.join("/")} px  ${encodeIco(icoEntries).length} bytes`);
console.log(`apple-icon.png ${appleSize} px`);

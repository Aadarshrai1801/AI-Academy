/**
 * Verification for the generated icons: decode them back and assert the mark
 * is where it should be. Guards against an encoder bug (swapped channels,
 * flipped rows, lost alpha) that a "file exists" check would miss.
 */
import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app");

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("bad PNG signature");
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6) throw new Error(`unexpected IHDR bitdepth/colourtype ${data[8]}/${data[9]}`);
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * 4);
  const stride = width * 4;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    if (filter !== 0) throw new Error(`row ${y} uses filter ${filter}, expected 0`);
    raw.copy(pixels, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  }
  return { width, height, pixels };
}

function px(image, x, y) {
  const o = (y * image.width + x) * 4;
  return [image.pixels[o], image.pixels[o + 1], image.pixels[o + 2], image.pixels[o + 3]];
}

function classify([r, g, b, a]) {
  if (a < 16) return "transparent";
  if (r < 90 && g < 60 && b < 60) return "ink";
  if (r > 150 && g > 40 && g < 200 && b < 90) return "orange";
  return `other(${r},${g},${b},${a})`;
}

function check(label, buffer) {
  const image = decodePng(buffer);
  const s = image.width;
  const at = (fx, fy) => px(image, Math.round(fx * (s - 1)), Math.round(fy * (s - 1)));
  const cases = [
    ["top-left corner (outside radius)", 0.01, 0.01, "transparent"],
    ["bottom-right corner (outside radius)", 0.99, 0.99, "transparent"],
    ["tile centre (between slashes)", 0.5, 0.5, "orange"],
    // Slash centres at y = 0.62, derived from the segment endpoints
    // (11,22.4)->(15.6,9.6) and (17.4,22.4)->(22,9.6) in 32-unit space.
    ["left slash", 0.3725, 0.62, "ink"],
    ["right slash", 0.5725, 0.62, "ink"],
    ["gap between slashes", 0.4725, 0.62, "orange"],
    ["gradient top of tile", 0.5, 0.12, "orange"],
  ];
  console.log(`\n${label}  ${s}x${s}`);
  let failures = 0;
  for (const [name, fx, fy, expected] of cases) {
    const actual = classify(at(fx, fy));
    const ok = actual === expected;
    if (!ok) failures += 1;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${name.padEnd(38)} expected ${expected.padEnd(11)} got ${actual}`);
  }
  return failures;
}

let failures = 0;

// ICO: walk the directory and verify every entry decodes and has the right size.
const ico = readFileSync(join(appDir, "favicon.ico"));
const count = ico.readUInt16LE(4);
console.log(`\nfavicon.ico entries: ${count}`);
for (let i = 0; i < count; i += 1) {
  const base = 6 + i * 16;
  const size = ico[base] === 0 ? 256 : ico[base];
  const length = ico.readUInt32LE(base + 8);
  const offset = ico.readUInt32LE(base + 12);
  const payload = ico.subarray(offset, offset + length);
  const image = decodePng(payload);
  const ok = image.width === size && image.height === size;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${size}x${size} declared, decoded ${image.width}x${image.height}, ${length} bytes`);
  if (size === 32) failures += check("  -> 32px icon mark", Buffer.from(payload));
}

failures += check("apple-icon.png", readFileSync(join(appDir, "apple-icon.png")));

console.log(failures === 0 ? "\nALL ICON CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

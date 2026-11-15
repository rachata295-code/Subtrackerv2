// Draws the placeholder PWA icons with Node built-ins only (zlib for the PNG deflate stream), so no image
// library is needed. A flat accent square with a geometric baht sign. Replace public/icons/* with real artwork
// before launch; run `node scripts/generate-icons.mjs` to regenerate these.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Colours come from the light-theme tokens (first :root block) so the icon never drifts from the palette.
const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
function token(name) {
  const m = new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`).exec(tokens);
  if (!m) throw new Error(`Token --${name} not found in tokens.css`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
const BG = token('accent');
const FG = token('on-accent');

// ---- the glyph, in unit coordinates (0..1), centred on (0.5, 0.5) --------------------------------------------
const S = 0.055; // stroke
const DX = 0.03; // shifts the glyph so its bounding box is centred
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 + DX && x <= x1 + DX && y >= y0 && y <= y1;
// Right half of a ring: the rounded side of the "B" bowls.
const halfRing = (cx, cy, r) => (x, y) => {
  const dx = x - (cx + DX);
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  return dx >= 0 && d <= r && d >= r - S;
};
const shapes = [
  rect(0.34, 0.3, 0.34 + S, 0.7), // B stem
  rect(0.34, 0.3, 0.5, 0.3 + S), // top bar
  rect(0.34, 0.7 - S, 0.5, 0.7), // bottom bar
  halfRing(0.5, 0.4, 0.1), // upper bowl
  halfRing(0.5, 0.6, 0.1), // lower bowl
  rect(0.445, 0.24, 0.445 + S, 0.76), // the baht sign's vertical stroke, longer than the B
];
// scale shrinks the glyph toward the centre (maskable icons are cropped to a circle by some launchers).
const inGlyph = (x, y, scale) => {
  const ux = (x - 0.5) / scale + 0.5;
  const uy = (y - 0.5) / scale + 0.5;
  return shapes.some((f) => f(ux, uy));
};

// ---- PNG encoding ----------------------------------------------------------------------------------------------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function renderPng(size, scale) {
  const AA = 3; // 3x3 supersampling keeps the curved edges smooth
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size); // filter byte 0 (none) is already zero
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hit = 0;
      for (let sy = 0; sy < AA; sy++)
        for (let sx = 0; sx < AA; sx++)
          if (inGlyph((px + (sx + 0.5) / AA) / size, (py + (sy + 0.5) / AA) / size, scale)) hit++;
      const t = hit / (AA * AA);
      for (let ch = 0; ch < 3; ch++) raw[py * stride + 1 + px * 3 + ch] = Math.round(BG[ch] + (FG[ch] - BG[ch]) * t);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(root, 'public/icons');
mkdirSync(outDir, { recursive: true });
const targets = [
  ['icon-192.png', 192, 1.3],
  ['icon-512.png', 512, 1.3],
  // Maskable: the launcher may crop to a circle, so keep the glyph well inside the central safe zone.
  ['icon-maskable-512.png', 512, 1],
  ['apple-touch-icon.png', 180, 1.3], // iOS applies its own rounding; it must be opaque, which this is
];
for (const [name, size, scale] of targets) {
  writeFileSync(join(outDir, name), renderPng(size, scale));
  console.log(`wrote public/icons/${name} (${size}x${size})`);
}

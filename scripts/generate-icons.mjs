// Generates the PWA icons in public/icons without any image dependencies.
// Usage: node scripts/generate-icons.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [11, 13, 16];
const ACCENT = [198, 244, 50];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const roundedRect = (x, y, x0, y0, x1, y1, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= x0 && x <= x1 && y >= y0 && y <= y1;
};

/** Dumbbell glyph centred in a unit square, scaled by `s`. */
function dumbbell(x, y, s) {
  const u = (v) => 0.5 + (v - 0.5) * s;
  const parts = [
    [0.18, 0.3, 0.27, 0.7], // left outer plate
    [0.28, 0.22, 0.38, 0.78], // left inner plate
    [0.62, 0.22, 0.72, 0.78], // right inner plate
    [0.73, 0.3, 0.82, 0.7], // right outer plate
    [0.37, 0.45, 0.63, 0.55], // bar
  ];
  return parts.some(([x0, y0, x1, y1]) => roundedRect(x, y, u(x0), u(y0), u(x1), u(y1), 0.02 * s));
}

function icon(maskable) {
  return (x, y) => {
    const inBg = maskable || roundedRect(x, y, 0, 0, 1, 1, 0.22);
    if (!inBg) return [0, 0, 0, 0];
    return dumbbell(x, y, maskable ? 0.62 : 0.85) ? [...ACCENT, 255] : [...BG, 255];
  };
}

writeFileSync("public/icons/icon-192.png", png(192, icon(false)));
writeFileSync("public/icons/icon-512.png", png(512, icon(false)));
writeFileSync("public/icons/icon-maskable-512.png", png(512, icon(true)));
console.log("icons written to public/icons");

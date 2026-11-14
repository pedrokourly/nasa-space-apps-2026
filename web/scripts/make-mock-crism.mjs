// Generates web/public/data/mock/crism.png: a small RGBA image of made-up, striped colored blobs
// on a transparent background. Placeholder for the CRISM overlay until Data/GIS delivers the real
// one. Built-ins only: node web/scripts/make-mock-crism.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 256;
const H = 160;
// [cx, cy, radius, [r, g, b]]
const BLOBS = [
  [80, 70, 48, [63, 169, 245]], // carbonate (mock)
  [165, 95, 40, [230, 80, 74]], // olivine (mock)
  [120, 125, 26, [178, 102, 224]], // other (mock)
];

const px = Buffer.alloc(W * H * 4); // transparent black
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // Last blob wins on overlap. Stripes mark it as obviously synthetic.
    for (const [cx, cy, r, [R, G, B]] of BLOBS) {
      if (Math.hypot(x - cx, y - cy) > r) continue;
      const i = (y * W + x) * 4;
      px[i] = R;
      px[i + 1] = G;
      px[i + 2] = B;
      px[i + 3] = (x + y) % 12 < 6 ? 210 : 120;
    }
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
// Each scanline starts with filter type 0 (none).
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
const out = new URL('../public/data/mock/crism.png', import.meta.url);
writeFileSync(out, png);
console.log(`wrote ${out.pathname} (${png.length} bytes, ${W}x${H})`);

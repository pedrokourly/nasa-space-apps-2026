// Exports the CRISM mineral overlay for the 2D map (issue #64): web/public/data/crism.png + crism.json.
//
// Source: MRO/CRISM MTRDR browse product FRT00005C5E_07_BRCARJ_MTR3 (CAR: red = D2300,
// green = BD2500_2, blue = BD1900_2), PDS Geosciences Node, volume MROCR_4001. See docs/crism.md.
//
// Usage (Node 18+, built-ins only, no Python/GDAL needed for this step):
//   node pipeline/export_crism.mjs <path/to/frt00005c5e_07_brcarj_mtr3.png> [--stats]
// Download the PNG first (do not commit it):
//   https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/browse/2007/2007_139/FRT00005C5E/frt00005c5e_07_brcarj_mtr3.png
//
// Georeferencing: the product is EQUIRECTANGULAR (center latitude 15°N), so x is linear in longitude
// and y is linear in latitude; the image only needs its pixel-EDGE bbox to be stretched by
// L.imageOverlay. The label's MINIMUM/MAXIMUM_LATITUDE and WESTERN/EASTERNMOST_LONGITUDE are the
// CENTERS of the outer pixels (the longitude span is exactly 889 px for 890 samples), so the bbox
// below adds half a pixel on each side. Pixel size from MAP_RESOLUTION = 3291.7295604 px/deg.
//
// Display processing (not a classification): the composite is mostly dark red. Pixels with a weak
// signal are faded out so the CTX/HiRISE imagery stays readable under the overlay. The colors of
// the remaining pixels are the original browse colors, unchanged.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAP_RESOLUTION = 3291.7295604; // px per degree of latitude (label)
const CENTER_LAT = 15; // standard parallel (label)
const LABEL = { west: 77.279195, east: 77.558793, south: 18.364672, north: 18.635047 };
const halfLat = 0.5 / MAP_RESOLUTION;
const halfLon = 0.5 / (MAP_RESOLUTION * Math.cos((CENTER_LAT * Math.PI) / 180));
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const BBOX = [r6(LABEL.west - halfLon), r6(LABEL.south - halfLat), r6(LABEL.east + halfLon), r6(LABEL.north + halfLat)];

// ASSUMPTION (display only): green channel (BD2500_2, the 2.5 µm carbonate band) at or above
// GREEN_FULL is fully shown; red-only signal (D2300) is shown faintly above RED_MIN.
const GREEN_MIN = 32;
const GREEN_FULL = 96;
const RED_MIN = 70;
const RED_FULL = 140;
const RED_MAX_ALPHA = 0.45;

// ---------- minimal PNG codec (8-bit RGBA, non-interlaced) ----------
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let w = 0, h = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('expected 8-bit RGBA, non-interlaced');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, px: out };
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(b) {
  let c = -1;
  for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- main ----------
const [input, flag] = process.argv.slice(2);
if (!input) {
  console.error('usage: node pipeline/export_crism.mjs <brcarj png> [--stats]');
  process.exit(1);
}
const { w, h, px } = decodePng(readFileSync(input));

if (flag === '--stats') {
  const hist = (ch) => {
    const hgm = new Array(8).fill(0);
    for (let i = 0; i < px.length; i += 4) if (px[i + 3]) hgm[px[i + ch] >> 5]++;
    return hgm.join(' ');
  };
  console.log(`size ${w}x${h}; histograms in 8 bins of 32 (valid pixels only)`);
  console.log('R', hist(0));
  console.log('G', hist(1));
  console.log('B', hist(2));
  process.exit(0);
}

const ramp = (v, lo, hi) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
let shown = 0;
for (let i = 0; i < px.length; i += 4) {
  const a0 = px[i + 3] / 255;
  if (!a0) continue;
  const k = Math.max(ramp(px[i + 1], GREEN_MIN, GREEN_FULL), RED_MAX_ALPHA * ramp(px[i], RED_MIN, RED_FULL));
  px[i + 3] = Math.round(255 * a0 * k);
  if (px[i + 3]) shown++;
  else px.fill(0, i, i + 3); // fully transparent: zero the color so the PNG compresses well
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'web', 'public', 'data');
writeFileSync(join(outDir, 'crism.png'), encodePng(w, h, px));
const meta = {
  bbox: BBOX,
  product_id: 'FRT00005C5E_07_BRCARJ_MTR3',
  acquired: '2007-05-19',
  mineral: 'Carbonate',
  legend: {
    title: 'CRISM carbonate browse (needs spectral confirmation)',
    entries: [
      { color: '#9be032', label: 'Green-yellow: carbonate-bearing, likely (2.3 + 2.5 µm bands)' },
      { color: '#8c1c1c', label: 'Red: Fe/Mg phyllosilicate, possible (2.3 µm band only)' },
    ],
  },
};
writeFileSync(join(outDir, 'crism.json'), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`wrote crism.png (${w}x${h}, ${shown} visible px) and crism.json, bbox ${BBOX.join(', ')}`);

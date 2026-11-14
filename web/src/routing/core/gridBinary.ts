/**
 * Decoding and encoding of the contract grid files (`elevation.bin`, `slope.bin`, optional `sand.bin`):
 * row-major, row 0 = north. Elevation and slope are Float32 little-endian; sand is one Uint8 per cell.
 * Pure logic (no fetch, no DOM). Reads through `DataView` with explicit little-endian, so it does not
 * depend on the machine's byte order.
 */
import type { Meta } from '../../types/contract';
import { createGrid, type Grid } from './grid';

/** Decodes `expected` Float32 LE values; throws if the byte size does not match. */
export function decodeFloat32LE(buf: ArrayBuffer, expected: number, name: string): Float32Array {
  if (buf.byteLength !== expected * 4) {
    throw new Error(`${name} has ${buf.byteLength} bytes; expected ${expected * 4} (${expected} Float32 values)`);
  }
  const view = new DataView(buf);
  const out = new Float32Array(expected);
  for (let i = 0; i < expected; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

/** Encodes values as Float32 LE (used to write the mock files). */
export function encodeFloat32LE(values: Float32Array): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) view.setFloat32(i * 4, values[i]!, true);
  return bytes;
}

/** Decodes the sand layer: one byte per cell, 1 = sand, 0 = not sand. Throws on a wrong size or another value. */
export function decodeSand(buf: ArrayBuffer, expected: number): Uint8Array {
  if (buf.byteLength !== expected) {
    throw new Error(`sand.bin has ${buf.byteLength} bytes; expected ${expected} (one Uint8 per cell)`);
  }
  const out = new Uint8Array(buf.slice(0));
  for (let i = 0; i < out.length; i++) {
    if (out[i]! > 1) throw new Error(`sand.bin has value ${out[i]} at cell ${i}; only 0 or 1 are allowed`);
  }
  return out;
}

/**
 * Builds a `Grid` from an already validated `meta` (see `parseMeta`) and the files.
 * Also checks what `parseMeta` does not: a non-empty `bbox`, positive cell sizes, and that `sand`
 * is given exactly when `meta.sand_layer` is `true`.
 */
export function gridFromBuffers(meta: Meta, elevation: ArrayBuffer, slope: ArrayBuffer, sand?: ArrayBuffer): Grid {
  const [minLon, minLat, maxLon, maxLat] = meta.bbox;
  if (!(minLon < maxLon) || !(minLat < maxLat)) {
    throw new Error(`invalid bbox: [${meta.bbox.join(', ')}] (expected [minLon, minLat, maxLon, maxLat])`);
  }
  if (!(meta.m_per_cell_x > 0) || !(meta.m_per_cell_y > 0)) {
    throw new Error('m_per_cell_x and m_per_cell_y must be > 0');
  }
  if (Boolean(meta.sand_layer) !== (sand !== undefined)) {
    throw new Error(meta.sand_layer ? 'meta.json has sand_layer: true but sand.bin is missing' : 'sand.bin given but meta.json has no sand_layer');
  }
  const n = meta.width * meta.height;
  return createGrid({
    meta,
    elevation: decodeFloat32LE(elevation, n, 'elevation.bin'),
    slope: decodeFloat32LE(slope, n, 'slope.bin'),
    ...(sand ? { sand: decodeSand(sand, n) } : {}),
  });
}

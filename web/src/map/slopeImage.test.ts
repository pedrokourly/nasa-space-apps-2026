import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeFloat32LE } from '../routing/core/gridBinary';
import { parseMeta } from '../lib/loadData';
import { SLOPE_LIMIT_DEG, SLOPE_MIN_DEG, slopeColor, slopeToRgba } from './slopeImage';

const dir = new URL('../../public/data/', import.meta.url);
const meta = parseMeta(JSON.parse(readFileSync(new URL('meta.json', dir), 'utf8')));

describe('slope hazard colors', () => {
  it('is transparent below the minimum and on no-data cells', () => {
    expect(slopeColor(meta, 0)[3]).toBe(0);
    expect(slopeColor(meta, SLOPE_MIN_DEG - 0.1)[3]).toBe(0);
    expect(slopeColor(meta, meta.nodata)[3]).toBe(0);
    expect(slopeColor(meta, Number.NaN)[3]).toBe(0);
  });

  it('is solid red from the routing limit up (same limit the A* treats as impassable)', () => {
    expect(SLOPE_LIMIT_DEG).toBe(25);
    expect(slopeColor(meta, SLOPE_LIMIT_DEG)).toEqual([224, 32, 27, 255]);
    expect(slopeColor(meta, 60)).toEqual([224, 32, 27, 255]);
  });

  it('gets more opaque as the slope grows between the minimum and the limit', () => {
    const a = slopeColor(meta, 12)[3];
    const b = slopeColor(meta, 22)[3];
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });

  it('paints the real Jezero grid: one pixel per cell, some red, some transparent', () => {
    const slope = decodeFloat32LE(
      readFileSync(new URL('slope.bin', dir)).buffer.slice(0) as ArrayBuffer,
      meta.width * meta.height,
      'slope.bin',
    );
    const rgba = slopeToRgba(meta, slope);
    expect(rgba.length).toBe(meta.width * meta.height * 4);
    let red = 0;
    let clear = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] === 255 && rgba[i] === 224) red++;
      if (rgba[i + 3] === 0) clear++;
    }
    expect(red).toBeGreaterThan(0);
    expect(clear).toBeGreaterThan(0);
  });
});

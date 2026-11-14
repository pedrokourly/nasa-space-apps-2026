import { describe, expect, it } from 'vitest';
import type { Meta } from '../../types/contract';
import { cellIndex, cellToLonLat, createGrid, inBounds, isNoData, lonLatToCell } from './grid';

const meta: Meta = {
  bbox: [77, 18, 78, 19],
  width: 10,
  height: 20,
  m_per_cell_x: 1,
  m_per_cell_y: 1,
  lon_convention: '-180..180',
  nodata: -3.4028234663852886e38,
  crs: 'EPSG:4326',
  row0: 'north',
  dtype: 'float32le',
};

describe('createGrid', () => {
  it('accepts arrays sized as meta says', () => {
    const n = meta.width * meta.height;
    expect(() => createGrid({ meta, elevation: new Float32Array(n), slope: new Float32Array(n) })).not.toThrow();
  });

  it('rejects wrong sizes and invalid meta', () => {
    const n = meta.width * meta.height;
    expect(() => createGrid({ meta, elevation: new Float32Array(n - 1), slope: new Float32Array(n) })).toThrow(/elevation/);
    expect(() => createGrid({ meta, elevation: new Float32Array(n), slope: new Float32Array(n), sand: new Uint8Array(3) })).toThrow(/sand/);
    expect(() => createGrid({ meta: { ...meta, width: 0 }, elevation: new Float32Array(0), slope: new Float32Array(0) })).toThrow(/meta/);
  });
});

describe('indexes and bounds', () => {
  it('cellIndex is row-major', () => {
    expect(cellIndex(meta, 3, 2)).toBe(2 * 10 + 3);
  });

  it('inBounds', () => {
    expect(inBounds(meta, 0, 0)).toBe(true);
    expect(inBounds(meta, 9, 19)).toBe(true);
    expect(inBounds(meta, 10, 0)).toBe(false);
    expect(inBounds(meta, 0, -1)).toBe(false);
    expect(inBounds(meta, 1.5, 1)).toBe(false);
  });
});

describe('isNoData', () => {
  it('recognizes nodata stored as Float32 and NaN, but not zero', () => {
    const f = new Float32Array([meta.nodata, NaN, 0, -2500]);
    expect(isNoData(meta, f[0]!)).toBe(true);
    expect(isNoData(meta, f[1]!)).toBe(true);
    expect(isNoData(meta, f[2]!)).toBe(false);
    expect(isNoData(meta, f[3]!)).toBe(false);
  });
});

describe('cell ↔ lon/lat', () => {
  it('row 0 is north and the center sits half a cell inside', () => {
    const [lon, lat] = cellToLonLat(meta, 0, 0);
    expect(lon).toBeCloseTo(77.05, 10);
    expect(lat).toBeCloseTo(18.975, 10);
    const [lon2, lat2] = cellToLonLat(meta, 9, 19);
    expect(lon2).toBeCloseTo(77.95, 10);
    expect(lat2).toBeCloseTo(18.025, 10);
  });

  it('round trip returns the same cell', () => {
    for (const [col, row] of [[0, 0], [9, 19], [4, 7], [9, 0]] as const) {
      expect(lonLatToCell(meta, cellToLonLat(meta, col, row))).toEqual({ col, row });
    }
  });

  it('points on the edges belong to the edge cells and outside the bbox is null', () => {
    expect(lonLatToCell(meta, [77, 19])).toEqual({ col: 0, row: 0 });
    expect(lonLatToCell(meta, [78, 18])).toEqual({ col: 9, row: 19 });
    expect(lonLatToCell(meta, [76.99, 18.5])).toBeNull();
    expect(lonLatToCell(meta, [77.5, 19.01])).toBeNull();
  });

  it('longitude stays in −180 to 180 for a negative bbox', () => {
    const m: Meta = { ...meta, bbox: [-180, -10, -170, 0] };
    const [lon] = cellToLonLat(m, 0, 0);
    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
    expect(lonLatToCell(m, [-175, -5])).toEqual({ col: 5, row: 10 });
  });
});

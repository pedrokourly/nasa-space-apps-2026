/// <reference types="node" />
/**
 * Checks on the REAL Jezero grid in `public/data/` (Data/GIS pipeline, MRO/HiRISE DTM), loaded the
 * same way the Worker does. If Data/GIS regenerates the files and one of these fails, the grid
 * changed in a way routing has to look at before shipping.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { LonLat } from '../lib/mars-geo';
import { parseMeta } from '../lib/loadData';
import { cellIndex, isNoData, lonLatToCell, type Grid } from './core/grid';
import { route } from './core/route';
import { loadGrid } from './loadGrid';

const dataDir = new URL('../../public/data/', import.meta.url);
const diskFetch = async (url: string): Promise<Response> =>
  new Response(readFileSync(new URL(url.slice(url.lastIndexOf('/') + 1), dataDir)));
const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'));

/** Demo stops: habitat and the three targets (coordinates of the mock `targets.geojson`), back to the habitat. */
const HABITAT: LonLat = [77.4508, 18.4447];
const DEMO: LonLat[] = [HABITAT, [77.385, 18.455], [77.425, 18.47], [77.47, 18.42], HABITAT];

let grid: Grid;
beforeAll(async () => {
  grid = await loadGrid('/data/', diskFetch);
});

describe('real Jezero grid (public/data)', () => {
  it('has the same geometry as the mock, so targets and clicks line up', () => {
    const real = parseMeta(readJson(new URL('meta.json', dataDir)));
    const mock = parseMeta(readJson(new URL('mock/meta.json', dataDir)));
    expect([real.bbox, real.width, real.height, real.m_per_cell_x, real.m_per_cell_y]).toEqual([
      mock.bbox,
      mock.width,
      mock.height,
      mock.m_per_cell_x,
      mock.m_per_cell_y,
    ]);
    expect(real.source).toMatch(/HiRISE/);
  });

  it('elevation has no holes and a plausible range for Jezero (meters)', () => {
    let min = Infinity;
    let max = -Infinity;
    for (const e of grid.elevation) {
      expect(isNoData(grid.meta, e)).toBe(false);
      min = Math.min(min, e);
      max = Math.max(max, e);
    }
    expect(min).toBeGreaterThan(-2700);
    expect(max).toBeLessThan(-2300);
  });

  it('slope is in degrees (0 to 90), no data only on the 1-cell border, and little of it is impassable', () => {
    const { width: w, height: h } = grid.meta;
    let steep = 0;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const s = grid.slope[cellIndex(grid.meta, col, row)]!;
        const border = row === 0 || col === 0 || row === h - 1 || col === w - 1;
        expect(isNoData(grid.meta, s)).toBe(border);
        if (border) continue;
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(90);
        if (s >= 25) steep++;
      }
    }
    // Measured 0.46% at >= 25° (max 43.7°): a mostly smooth crater floor, as Data/GIS documented.
    expect(steep / (w * h)).toBeLessThan(0.02);
  });

  it('the demo stops sit on valid cells', () => {
    for (const p of DEMO) {
      const c = lonLatToCell(grid.meta, p)!;
      expect(c).not.toBeNull();
      expect(grid.slope[cellIndex(grid.meta, c.col, c.row)]!).toBeLessThan(25);
    }
  });

  it('demo loop (habitat, 3 targets, habitat) is found, GO with the default O₂, in well under 1 s', () => {
    const t0 = performance.now();
    const r = route(grid, DEMO);
    const ms = performance.now() - t0;
    expect(r.properties.verdict).toBe('GO');
    expect(r.properties.point_of_no_return).toBeUndefined();
    expect(r.properties.dist_m).toBeGreaterThan(10_000);
    expect(r.properties.dist_m).toBeLessThan(15_000);
    expect(ms).toBeLessThan(1000);
  });

  it('no route cell is impassable', () => {
    const r = route(grid, DEMO);
    for (const [lon, lat] of r.geometry.coordinates) {
      const c = lonLatToCell(grid.meta, [lon, lat])!;
      expect(grid.slope[cellIndex(grid.meta, c.col, c.row)]!).toBeLessThan(25);
    }
  });
});
